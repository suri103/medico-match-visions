import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhoneOff, Video } from 'lucide-react';
import { sendWebRtcSignal, openEventStream } from '@/services/api';

// Professional 1:1 calling over WebRTC with signaling relayed through the
// authenticated API + SSE. Topology: full-mesh 1:1 (correct at this scale);
// group calls would need an SFU service.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

interface CallModalProps {
  open: boolean;
  onClose: () => void;
  peerUserId: string;
  peerName: string;
  /** When true we create the offer; otherwise we wait for the peer's. */
  startCall?: boolean;
}

export const CallModal: React.FC<CallModalProps> = ({ open, onClose, peerUserId, peerName, startCall }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ringing' | 'live' | 'ended'>('idle');
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Audit M16: ICE candidates can arrive BEFORE the remote description is set
  // (the answer is still in flight). Calling addIceCandidate then throws and
  // kills the call ("Connection problem") - candidates are queued instead.
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription || !pc.remoteDescription.type) return;
    for (const c of pendingIceRef.current.splice(0)) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* stale candidate after renegotiation - ignore */
      }
    }
  };

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => { try { s.track?.stop(); } catch { /* */ } });
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const hangUp = useCallback(() => {
    cleanup();
    setStatus('ended');
    setTimeout(onClose, 900);
  }, [cleanup, onClose]);

  async function ensurePc(): Promise<RTCPeerConnection> {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) void sendWebRtcSignal(peerUserId, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) remoteVideoRef.current.srcObject = e.streams[0];
      setStatus('live');
    };
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    return pc;
  }

  // Signaling receive path (offers/answers/ICE) over SSE.
  useEffect(() => {
    if (!open) return;
    return openEventStream({
      onOpen: () => { if (startCall) void placeOffer(); },
      onWebRtc: async (sig) => {
        if (sig.from !== peerUserId) return;
        try {
          const pc = await ensurePc();
          if (sig.payload.type === 'offer') {
            setStatus('ringing');
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp as RTCSessionDescriptionInit));
            await flushPendingCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void sendWebRtcSignal(peerUserId, { type: 'answer', sdp: answer });
          } else if (sig.payload.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp as RTCSessionDescriptionInit));
            await flushPendingCandidates(pc);
          } else if (sig.payload.candidate) {
            // Audit M16: queue candidates that arrive before the remote
            // description; addIceCandidate would otherwise throw and kill the call.
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(sig.payload.candidate as RTCIceCandidateInit));
            } else {
              pendingIceRef.current.push(sig.payload.candidate as RTCIceCandidateInit);
            }
          }
        } catch {
          setError('Connection problem. Please retry.');
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, peerUserId]);

  async function placeOffer() {
    try {
      setStatus('connecting');
      const pc = await ensurePc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void sendWebRtcSignal(peerUserId, { type: 'offer', sdp: offer });
    } catch {
      setError('Camera/microphone unavailable — check browser permissions.');
      setStatus('idle');
    }
  }

  const acceptIncoming = async () => {
    try {
      setStatus('connecting');
      await ensurePc(); // pending offer is applied by the signal handler
    } catch {
      setError('Camera/microphone unavailable — check browser permissions.');
    }
  };

  useEffect(() => {
    if (!open) cleanup();
  }, [open, cleanup]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && hangUp()}>
      <DialogContent className="sm:max-w-2xl bg-black/95 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Video size={18} /> Call with Dr. {peerName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {error ? error : status === 'live' ? 'Connected.' :
             status === 'ringing' ? `Incoming call from Dr. ${peerName}` :
             status === 'connecting' ? 'Connecting…' : 'Preparing…'}
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <video ref={localVideoRef} autoPlay muted playsInline
            className="absolute bottom-3 right-3 w-28 h-20 rounded-md object-cover border border-slate-700 bg-slate-800" />
          {status !== 'live' && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              {status === 'ringing' ? (
                <Button onClick={() => void acceptIncoming()} className="bg-emerald-600 hover:bg-emerald-700">Accept call</Button>
              ) : (
                <span>{status === 'connecting' ? `Reaching Dr. ${peerName}…` : 'Preparing…'}</span>
              )}
            </div>
          )}
        </div>
        <Button variant="destructive" onClick={hangUp} className="w-full">
          <PhoneOff size={16} className="mr-2" /> End call
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default CallModal;