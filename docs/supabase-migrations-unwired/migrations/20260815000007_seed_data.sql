-- ===========================================================================
-- ⛔ ARCHIVED — DO NOT RUN THIS FILE AGAINST A DATABASE.
--
-- This migration set is NOT wired to the application. The live schema is
-- server/migrations/schema.sql, applied at boot by migrate() in
-- server/src/db.mjs behind a Postgres advisory lock.
--
-- Applying this file would create a parallel schema (different table names,
-- enum types and column shapes), and its RLS policies + SECURITY DEFINER
-- RPC would expose the tables to direct authenticated access and bypass every
-- quota check in server/src/domain.mjs.
--
-- The guard below aborts the transaction immediately. Removing it is a
-- deliberate, reviewed act. See ../README.md.
-- ===========================================================================
DO $$
BEGIN
  RAISE EXCEPTION 'MedicoMatch: this migration file is ARCHIVED and must not be applied. The live schema is server/migrations/schema.sql.';
END
$$;

-- =============================================================================
-- MedicoMatch Supabase Migration: 007_seed_data.sql
-- Description: Comprehensive Seed Data for Verified Doctors & Matrimonial Profiles
-- =============================================================================

DO $$
DECLARE
    doc1_id UUID := 'a0000000-0000-0000-0000-000000000001';
    doc2_id UUID := 'a0000000-0000-0000-0000-000000000002';
    doc3_id UUID := 'a0000000-0000-0000-0000-000000000003';
    doc4_id UUID := 'a0000000-0000-0000-0000-000000000004';
    doc5_id UUID := 'a0000000-0000-0000-0000-000000000005';
    doc6_id UUID := 'a0000000-0000-0000-0000-000000000006';
    doc7_id UUID := 'a0000000-0000-0000-0000-000000000007';
    doc8_id UUID := 'a0000000-0000-0000-0000-000000000008';
BEGIN

    -- -------------------------------------------------------------------------
    -- 1. SEED PROFILES
    -- -------------------------------------------------------------------------
    INSERT INTO public.profiles (
        id, email, phone, full_name, title, gender, age, height_cm, marital_status,
        degree, specialty, sub_specialty, hospital_name, city, state, country,
        council_name, registration_number, registration_year, verification_status, is_verified,
        about_me, family_background, is_online
    ) VALUES
    (
        doc1_id, 'dr.aditya.sharma@lilavati.in', '+91 98201 11223', 'Dr. Aditya Sharma', 'Dr.', 'Male', 31, 180, 'Never Married',
        'MD, DM (Cardiology)', 'Cardiology', 'Interventional Cardiology', 'Lilavati Hospital & Research Centre', 'Mumbai', 'Maharashtra', 'India',
        'Maharashtra Medical Council (MMC)', 'MMC-2017/04/1042', 2017, 'verified', TRUE,
        'Dedicated Interventional Cardiologist committed to patient care and academic research. Enjoy playing squash, classical piano, and weekend trekking.',
        'Father is a retired Professor of Medicine, mother is a High Court Advocate. Younger sister is pursuing MDS.', TRUE
    ),
    (
        doc2_id, 'dr.priya.patel@apollo.in', '+91 98112 33445', 'Dr. Priya Patel', 'Dr.', 'Female', 29, 165, 'Never Married',
        'MD (Neurology), MBBS', 'Neurology', 'Pediatric Neurology', 'Apollo Hospital Indraprastha', 'Delhi', 'Delhi NCR', 'India',
        'Delhi Medical Council (DMC)', 'DMC-2019/08/9981', 2019, 'verified', TRUE,
        'Passionate pediatric neurologist working with young children. Value family harmony, deep conversations, and continuous medical learning.',
        'Both parents are senior doctors in Delhi running their own multi-specialty nursing home.', TRUE
    ),
    (
        doc3_id, 'dr.rajesh.gupta@fortis.in', '+91 98450 55667', 'Dr. Rajesh Gupta', 'Dr.', 'Male', 33, 178, 'Never Married',
        'MS (Orthopedics), MCh', 'Orthopedics', 'Joint Replacement & Arthroscopy', 'Fortis Hospital', 'Bangalore', 'Karnataka', 'India',
        'Karnataka Medical Council (KMC)', 'KMC-2015/11/4891', 2015, 'verified', TRUE,
        'Orthopedic joint replacement specialist. Enthusiastic about marathon running, high-altitude hiking, and medical photography.',
        'Upper middle-class family based in Bangalore with roots in Rajasthan. Father is an industrialist.', FALSE
    ),
    (
        doc4_id, 'dr.ananya.reddy@kims.in', '+91 98490 77889', 'Dr. Ananya Reddy', 'Dr.', 'Female', 28, 163, 'Never Married',
        'MD (Dermatology), DNB', 'Dermatology', 'Aesthetic & Clinical Dermatology', 'KIMS Hospital', 'Hyderabad', 'Telangana', 'India',
        'Telangana State Medical Council', 'TSMC-2020/03/7452', 2020, 'verified', TRUE,
        'Consultant Dermatologist and Trichologist. Love contemporary art, culinary experiments, and mindful yoga practice.',
        'Well-established family in Jubilee Hills, Hyderabad. Father is a civil engineer, mother is a college principal.', TRUE
    ),
    (
        doc5_id, 'dr.siddharth.deshmukh@kem.in', '+91 98230 88990', 'Dr. Siddharth Deshmukh', 'Dr.', 'Male', 32, 176, 'Never Married',
        'MS (General Surgery), DNB', 'General Surgery', 'Laparoscopic & Robotic Surgery', 'KEM Hospital & Seth GSMC', 'Pune', 'Maharashtra', 'India',
        'Maharashtra Medical Council (MMC)', 'MMC-2016/09/3120', 2016, 'verified', TRUE,
        'Laparoscopic Surgeon who believes in empathy, scientific rigor, and a healthy work-life balance. Avid chess player.',
        'Traditional Maharashtrian family. Parents are retired government officers based in Pune.', TRUE
    ),
    (
        doc6_id, 'dr.meera.iyer@apollo.in', '+91 98400 11234', 'Dr. Meera Iyer', 'Dr.', 'Female', 30, 162, 'Never Married',
        'MD (Radiology), MBBS', 'Radiology', 'Neuro-imaging & MRI Specialist', 'Apollo Main Hospital', 'Chennai', 'Tamil Nadu', 'India',
        'Tamil Nadu Medical Council', 'TNMC-2018/06/6190', 2018, 'verified', TRUE,
        'Diagnostic Radiologist with keen eye for detail. Classical Carnatic vocalist and passionate avid reader.',
        'Respected family in Chennai. Father is a retired scientist from ISRO, mother is a Carnatic music teacher.', FALSE
    ),
    (
        doc7_id, 'dr.vikram.singh@max.in', '+91 98100 99887', 'Dr. Vikram Singh', 'Dr.', 'Male', 34, 183, 'Never Married',
        'MD (Pediatrics), DM (Neonatology)', 'Pediatrics', 'Neonatal Intensive Care', 'Max Super Speciality Hospital', 'Gurgaon', 'Haryana', 'India',
        'Haryana Medical Council', 'HMC-2014/12/8821', 2014, 'verified', TRUE,
        'Neonatologist dedicated to newborn critical care. Enjoy road trips, golf, and mentoring young medical residents.',
        'Father is a retired Army Brigadier (AMC), mother is an educator.', TRUE
    ),
    (
        doc8_id, 'dr.sneha.mukherjee@amri.in', '+91 98300 44332', 'Dr. Sneha Mukherjee', 'Dr.', 'Female', 29, 160, 'Never Married',
        'MS (Obstetrics & Gynecology)', 'Gynecology', 'Fetal Medicine & High-Risk Pregnancy', 'AMRI Hospitals', 'Kolkata', 'West Bengal', 'India',
        'West Bengal Medical Council', 'WBMC-2019/02/4119', 2019, 'verified', TRUE,
        'Obstetrician & High-Risk Pregnancy specialist. Passionate about women health advocacy, Rabindra Sangeet, and baking.',
        'Academic family from South Kolkata. Father is a Professor of Economics, mother is a pediatrician.', TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 2. SEED PROFILE PHOTOS
    -- -------------------------------------------------------------------------
    INSERT INTO public.profile_photos (profile_id, photo_url, is_primary, display_order) VALUES
    (doc1_id, 'https://randomuser.me/api/portraits/men/32.jpg', TRUE, 1),
    (doc1_id, 'https://randomuser.me/api/portraits/men/33.jpg', FALSE, 2),
    (doc2_id, 'https://randomuser.me/api/portraits/women/44.jpg', TRUE, 1),
    (doc2_id, 'https://randomuser.me/api/portraits/women/45.jpg', FALSE, 2),
    (doc3_id, 'https://randomuser.me/api/portraits/men/68.jpg', TRUE, 1),
    (doc4_id, 'https://randomuser.me/api/portraits/women/65.jpg', TRUE, 1),
    (doc5_id, 'https://randomuser.me/api/portraits/men/46.jpg', TRUE, 1),
    (doc6_id, 'https://randomuser.me/api/portraits/women/29.jpg', TRUE, 1),
    (doc7_id, 'https://randomuser.me/api/portraits/men/52.jpg', TRUE, 1),
    (doc8_id, 'https://randomuser.me/api/portraits/women/58.jpg', TRUE, 1)
    ON CONFLICT DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 3. SEED KUNDALI & ASTROLOGY ATTRIBUTES
    -- -------------------------------------------------------------------------
    INSERT INTO public.kundali_profiles (
        profile_id, religion, caste, subcaste, gotra, mother_tongue, rashi, nakshatra, manglik_status
    ) VALUES
    (doc1_id, 'Hindu', 'Brahmin', 'Gour', 'Bharadwaja', 'Hindi', 'Mesha (Aries)', 'Ashwini', 'Non-Manglik'),
    (doc2_id, 'Hindu', 'Patel / Patidar', 'Kadva', 'Kashyapa', 'Gujarati', 'Vrishabha (Taurus)', 'Rohini', 'Non-Manglik'),
    (doc3_id, 'Hindu', 'Vaishya / Bania', 'Agarwal', 'Garg', 'Hindi', 'Mithuna (Gemini)', 'Mrigashira', 'Anshik Manglik'),
    (doc4_id, 'Hindu', 'Reddy', 'Motati', 'Vashishta', 'Telugu', 'Karka (Cancer)', 'Pushya', 'Non-Manglik'),
    (doc5_id, 'Hindu', 'Maratha', '96 Kuli', 'Sandilya', 'Marathi', 'Simha (Leo)', 'Magha', 'Non-Manglik'),
    (doc6_id, 'Hindu', 'Brahmin - Iyer', 'Vadama', 'Harita', 'Tamil', 'Kanya (Virgo)', 'Hasta', 'Non-Manglik'),
    (doc7_id, 'Sikh', 'Jat Sikh', 'Sandhu', 'Kashyapa', 'Punjabi', 'Tula (Libra)', 'Chitra', 'Non-Manglik'),
    (doc8_id, 'Hindu', 'Brahmin - Bengali', 'Kulin', 'Sandilya', 'Bengali', 'Vrishchika (Scorpio)', 'Anuradha', 'Non-Manglik')
    ON CONFLICT (profile_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 4. SEED LIFESTYLE & HOBBIES
    -- -------------------------------------------------------------------------
    INSERT INTO public.lifestyle_profiles (
        profile_id, dietary_habits, drinking_habits, smoking_habits, fitness_routine, interests, languages_spoken
    ) VALUES
    (doc1_id, 'Vegetarian', 'Non-Drinker', 'Non-Smoker', 'Squash & Gym 4 days a week', '{"Classical Piano", "Squash", "High Altitude Trekking", "Medical Podcasts"}', '{"English", "Hindi", "Marathi"}'),
    (doc2_id, 'Vegetarian', 'Non-Drinker', 'Non-Smoker', 'Yoga and Pilates', '{"Reading", "Child Health Advocacy", "Culinary Arts", "Travel"}', '{"English", "Hindi", "Gujarati"}'),
    (doc3_id, 'Non-Vegetarian', 'Social Drinker', 'Non-Smoker', 'Marathon Runner', '{"Marathons", "Photography", "Badminton", "Automotive"}', '{"English", "Hindi", "Kannada"}'),
    (doc4_id, 'Eggetarian', 'Non-Drinker', 'Non-Smoker', 'Mindful Yoga & Swimming', '{"Art Exhibitions", "Skin Wellness", "Culinary Experiments", "Yoga"}', '{"English", "Telugu", "Hindi"}'),
    (doc5_id, 'Non-Vegetarian', 'Non-Drinker', 'Non-Smoker', 'Weekend Cycling & Chess', '{"Chess", "Surgical Robotics", "Marathi Theater", "Hiking"}', '{"English", "Marathi", "Hindi"}'),
    (doc6_id, 'Vegetarian', 'Non-Drinker', 'Non-Smoker', 'Morning Pranayama', '{"Carnatic Music", "Ancient Architecture", "Book Clubs", "Violin"}', '{"English", "Tamil", "Hindi"}'),
    (doc7_id, 'Non-Vegetarian', 'Social Drinker', 'Non-Smoker', 'Golf & Weight Training', '{"Golf", "Automotive Roadtrips", "Mentorship", "Wildlife Photography"}', '{"English", "Punjabi", "Hindi"}'),
    (doc8_id, 'Fish & Egg', 'Non-Drinker', 'Non-Smoker', 'Classical Dance & Aerobics', '{"Rabindra Sangeet", "Baking", "Literary Festivals", "Cinema"}', '{"English", "Bengali", "Hindi"}')
    ON CONFLICT (profile_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 5. SEED USER QUOTAS (Default Gold/Free allocations)
    -- -------------------------------------------------------------------------
    INSERT INTO public.user_quotas (
        user_id, plan_tier, interests_total, interests_used, video_dates_total, video_dates_used, contacts_total, contacts_used, can_compose_custom_messages
    ) VALUES
    (doc1_id, 'gold', 25, 3, 3, 0, 15, 2, TRUE),
    (doc2_id, 'gold', 25, 2, 3, 1, 15, 1, TRUE),
    (doc3_id, 'platinum', 75, 8, 10, 2, 50, 4, TRUE),
    (doc4_id, 'free', 5, 1, 0, 0, 0, 0, FALSE),
    (doc5_id, 'gold', 25, 4, 3, 0, 15, 3, TRUE),
    (doc6_id, 'free', 5, 0, 0, 0, 0, 0, FALSE),
    (doc7_id, 'platinum', 75, 5, 10, 1, 50, 3, TRUE),
    (doc8_id, 'free', 5, 2, 0, 0, 0, 0, FALSE)
    ON CONFLICT (user_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 6. SEED UPCOMING EVENTS
    -- -------------------------------------------------------------------------
    INSERT INTO public.events (
        title, description, event_type, specialty_focus, city, scheduled_at, max_participants, current_attendees_count, is_active
    ) VALUES
    (
        'Virtual Speed Dating: Cardiologists & Neurologists',
        'Exclusive structured 5-minute video rotations for verified MD/DM doctors across Mumbai & Delhi.',
        'speed_dating', 'Cardiology & Neurology', 'Online (All India)', NOW() + INTERVAL '5 days', 40, 18, TRUE
    ),
    (
        'Mumbai Doctors Matrimonial High-Tea Mixer',
        'In-person afternoon networking and matrimonial mixer at South Mumbai luxury hotel.',
        'city_mixer', 'All Medical Specialties', 'Mumbai, Maharashtra', NOW() + INTERVAL '12 days', 60, 34, TRUE
    ),
    (
        'Surgeons & Physicians Nationwide Virtual Meet',
        'Connect with compatible surgeons, anesthetists, and physicians across India.',
        'virtual_meet', 'Surgery & Medicine', 'Online (All India)', NOW() + INTERVAL '18 days', 80, 42, TRUE
    )
    ON CONFLICT DO NOTHING;

END $$;
