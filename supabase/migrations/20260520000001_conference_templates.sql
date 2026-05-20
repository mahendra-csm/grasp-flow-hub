-- Conference templates table — admin-managed, shared across all authenticated users
CREATE TABLE IF NOT EXISTS public.conference_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  activity    text        NOT NULL,
  phase       text        NOT NULL CHECK (phase IN ('pre','during','post')),
  channel     text        NOT NULL CHECK (channel IN ('email','whatsapp','social')),
  subject     text,
  body        text        NOT NULL,
  variables   text[]      NOT NULL DEFAULT '{}',
  tags        text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conference_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON public.conference_templates;
CREATE POLICY "authenticated full access" ON public.conference_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_conference_templates_updated_at ON public.conference_templates;
CREATE TRIGGER set_conference_templates_updated_at
  BEFORE UPDATE ON public.conference_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Seed default templates ───────────────────────────────────────────────────

INSERT INTO public.conference_templates (title, activity, phase, channel, subject, body, variables, tags) VALUES

-- PRE / EMAIL
('Registration Invite', 'Email Marketing', 'pre', 'email',
 'You''re Invited: {{conference_name}} | {{date}}',
 E'Dear {{recipient_name}},\n\nWe are delighted to invite you to attend {{conference_name}}, scheduled on {{date}} at {{venue}}.\n\nThis premier conference brings together leading experts, researchers, and practitioners in {{field}} to share insights, innovations, and best practices.\n\nEvent Highlights:\n• Keynote addresses by renowned speakers\n• Paper & abstract presentations\n• Panel discussions & workshops\n• Networking opportunities\n\nRegistration Details:\n• Early Bird Deadline: {{early_bird_date}}\n• Regular Registration Deadline: {{registration_deadline}}\n• Registration Link: {{registration_link}}\n\nSecure your spot today and join hundreds of professionals shaping the future of {{field}}.\n\nFor queries, contact us at {{contact_email}} or call {{contact_phone}}.\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}\n{{website}}',
 ARRAY['recipient_name','conference_name','date','venue','field','early_bird_date','registration_deadline','registration_link','contact_email','contact_phone','organizer_name','organization_name','website'],
 ARRAY['invite','registration','marketing']),

('Early Bird Offer', 'Email Marketing', 'pre', 'email',
 'Last Chance: Early Bird Discount for {{conference_name}}!',
 E'Dear {{recipient_name}},\n\nEarly bird registration for {{conference_name}} closes on {{early_bird_date}}!\n\nSave {{discount_percentage}}% on your registration fee when you register before the deadline.\n\nEarly Bird Price: {{early_bird_price}} (Regular: {{regular_price}})\n\nDon''t miss this opportunity to:\n✓ Connect with {{participant_count}}+ industry leaders\n✓ Access cutting-edge research presentations\n✓ Participate in interactive workshops\n✓ Earn CPD/CME credits\n\nRegister Now: {{registration_link}}\n\nThis offer expires at midnight on {{early_bird_date}}.\n\nBest regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','early_bird_date','discount_percentage','early_bird_price','regular_price','participant_count','registration_link','organizer_name','organization_name'],
 ARRAY['early bird','discount','registration','marketing']),

('Past Conference Highlights', 'Email Marketing', 'pre', 'email',
 '{{conference_name}} — See What You Missed Last Year',
 E'Dear {{recipient_name}},\n\nAs we gear up for {{conference_name}} on {{date}}, we''d like to share some highlights from our previous edition.\n\nLast Year''s Highlights:\n• {{past_participant_count}}+ attendees from {{country_count}} countries\n• {{speaker_count}} distinguished speakers\n• {{paper_count}} research papers presented\n• {{highlight_1}}\n• {{highlight_2}}\n\nThis year, we''re raising the bar even higher!\n\nBe part of {{conference_name}} — the leading platform for {{field}} professionals.\n\nRegister Here: {{registration_link}}\nEarly Bird Ends: {{early_bird_date}}\n\nWe look forward to welcoming you!\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','date','past_participant_count','country_count','speaker_count','paper_count','highlight_1','highlight_2','field','registration_link','early_bird_date','organizer_name','organization_name'],
 ARRAY['highlights','past event','marketing']),

('Leads Follow-up', 'Leads Follow-up', 'pre', 'email',
 'Following Up: {{conference_name}} Registration',
 E'Dear {{recipient_name}},\n\nThank you for your interest in {{conference_name}} on {{date}}.\n\nWe noticed you haven''t completed your registration yet. We wanted to reach out personally to answer any questions you might have.\n\nQuick Registration: {{registration_link}}\n\nIf you have concerns about:\n• Fees/Payment — We offer flexible payment options\n• Topics — View our full agenda at {{agenda_link}}\n• Technical requirements — Our support team is here to help\n\nPlease reply to this email or contact us at {{contact_email}}.\n\nWe look forward to seeing you there!\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','date','registration_link','agenda_link','contact_email','organizer_name','organization_name'],
 ARRAY['follow-up','leads','conversion']),

('Abstract Submission CTA', 'Poster & Reels Creation', 'pre', 'email',
 'Call for Abstracts — {{conference_name}} | Deadline: {{abstract_deadline}}',
 E'Dear {{recipient_name}},\n\nWe invite you to submit your original research for presentation at {{conference_name}} on {{date}}.\n\nSubmission Categories:\n• Original Research Papers\n• Case Studies\n• Systematic Reviews\n• Poster Presentations\n\nSubmission Guidelines:\n• Word limit: {{word_limit}} words\n• Format: {{format}}\n• Deadline: {{abstract_deadline}}\n• Submit at: {{submission_link}}\n\nAccepted abstracts will be published in the conference proceedings with a DOI. Selected papers will be considered for journal publication.\n\nSubmit your abstract today: {{submission_link}}\n\nFor queries: {{review_email}}\n\nBest regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','date','word_limit','format','abstract_deadline','submission_link','review_email','organizer_name','organization_name'],
 ARRAY['abstract','submission','call for papers']),

('Abstract Received Confirmation', 'Abstract Review', 'pre', 'email',
 'Abstract Submission Received — {{conference_name}} | ID: {{submission_id}}',
 E'Dear {{author_name}},\n\nThank you for submitting your abstract "{{abstract_title}}" for {{conference_name}}.\n\nSubmission ID: {{submission_id}}\nSubmitted On: {{submission_date}}\n\nWhat happens next:\n1. Your abstract will undergo peer review by our expert committee\n2. Review results will be communicated by {{review_deadline}}\n3. Accepted abstracts will receive presentation slot details\n\nFor queries regarding your submission, contact {{review_email}} with your Submission ID.\n\nThank you for contributing to the advancement of {{field}}.\n\nBest regards,\n{{review_committee_name}}\n{{conference_name}} Organizing Committee',
 ARRAY['author_name','abstract_title','conference_name','submission_id','submission_date','review_deadline','review_email','field','review_committee_name'],
 ARRAY['abstract','confirmation','review']),

('Speaker Confirmation & Requirements', 'Speaker Allocation', 'pre', 'email',
 'Speaker Confirmation — {{conference_name}} | {{date}}',
 E'Dear {{speaker_name}},\n\nWe are pleased to confirm your participation as a speaker at {{conference_name}} on {{date}}.\n\nYour Session Details:\n• Topic: {{talk_title}}\n• Date & Time: {{session_date_time}}\n• Duration: {{duration}} minutes (including Q&A)\n• Session Room/Link: {{room_or_link}}\n\nAction Required — Please send us by {{deadline}}:\n☐ Final presentation title and abstract (250 words)\n☐ Your professional bio (150 words)\n☐ High-resolution headshot (JPG/PNG, min 300 DPI)\n☐ Final presentation slides (PowerPoint/PDF)\n\nTechnical Setup:\nWe will conduct a tech rehearsal on {{rehearsal_date}} at {{rehearsal_time}}.\nRehearsal Link: {{rehearsal_link}}\n\nPlease confirm your availability by replying to this email.\n\nLooking forward to your valuable contribution!\n\nBest regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['speaker_name','conference_name','date','talk_title','session_date_time','duration','room_or_link','deadline','rehearsal_date','rehearsal_time','rehearsal_link','organizer_name','organization_name'],
 ARRAY['speaker','confirmation','requirements']),

('Google Meet Details', 'Google Meet Setup', 'pre', 'email',
 '{{conference_name}} — Meeting Link & Access Details',
 E'Dear {{recipient_name}},\n\nYour meeting details for {{conference_name}} are ready.\n\nMeeting Details:\n• Date: {{date}}\n• Time: {{time}} ({{timezone}})\n• Meeting Link: {{meet_link}}\n• Meeting ID: {{meeting_id}}\n• Password: {{password}}\n\nBefore the meeting, please:\n✓ Test your audio and video\n✓ Use a stable internet connection\n✓ Join 5 minutes early\n✓ Keep your microphone muted when not speaking\n✓ Use a quiet, well-lit location\n\nFor technical support, contact {{tech_support_email}}.\n\nSee you online!\n\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','date','time','timezone','meet_link','meeting_id','password','tech_support_email','organizer_name','organization_name'],
 ARRAY['google meet','virtual','setup','link']),

('Keynote Speaker Profile Request', 'Keynote Speaker Prep', 'pre', 'email',
 'Keynote Speaker Profile Request — {{conference_name}}',
 E'Dear {{speaker_name}},\n\nCongratulations on being selected as a Keynote Speaker at {{conference_name}} on {{date}}!\n\nTo help us showcase your expertise to our audience, we kindly request the following by {{deadline}}:\n\n1. Keynote Topic & Title\n   Please confirm/suggest your keynote topic aligned with the theme: "{{conference_theme}}"\n\n2. Abstract (300 words)\n   A brief overview of your keynote presentation\n\n3. Speaker Profile\n   • Professional bio (200 words)\n   • Current designation & organization\n   • LinkedIn profile URL\n\n4. Photo\n   • High-resolution professional headshot (min 1MB, JPG/PNG)\n\n5. Presentation Slides\n   • Format: PowerPoint (.pptx) or PDF\n   • Due date: {{slides_deadline}}\n\nPlease send all materials to {{organizer_email}}.\n\nWe are honoured to have you with us!\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['speaker_name','conference_name','date','deadline','conference_theme','slides_deadline','organizer_email','organizer_name','organization_name'],
 ARRAY['keynote','speaker','profile','materials']),

-- PRE / WHATSAPP
('Registration Invite', 'Email Marketing', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}}! 👋\n\nYou''re invited to *{{conference_name}}* 🎓\n\n📅 Date: {{date}}\n📍 Venue: {{venue}}\n🔗 Register: {{registration_link}}\n\nEarly bird ends {{early_bird_date}}. Limited seats!\n\nFor queries: {{contact_phone}}\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','date','venue','registration_link','early_bird_date','contact_phone','organization_name'],
 ARRAY['invite','registration']),

('Early Bird Reminder', 'WhatsApp Catalogue', 'pre', 'whatsapp',
 NULL,
 E'⏰ *Early Bird Ends {{early_bird_date}}!*\n\nHi {{recipient_name}},\n\nDon''t miss {{discount_percentage}}% off on *{{conference_name}}* registration!\n\n💰 Early Bird: {{early_bird_price}}\n💰 Regular: {{regular_price}}\n\n👆 Register: {{registration_link}}\n\nHurry, offer expires at midnight!\n_{{organization_name}}_',
 ARRAY['recipient_name','early_bird_date','discount_percentage','conference_name','early_bird_price','regular_price','registration_link','organization_name'],
 ARRAY['early bird','discount','reminder']),

('Leads Follow-up', 'Leads Follow-up', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}} 👋\n\nWe noticed you were interested in *{{conference_name}}* on {{date}}.\n\nHave any questions? We''re happy to help! 😊\n\n📝 Register: {{registration_link}}\n📞 Call/WhatsApp: {{contact_phone}}\n📧 Email: {{contact_email}}\n\nSee you there! 🎉\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','date','registration_link','contact_phone','contact_email','organization_name'],
 ARRAY['follow-up','leads']),

('Payment Reminder', 'WhatsApp Catalogue', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}} 👋\n\nFriendly reminder: Your registration for *{{conference_name}}* is pending payment.\n\n💳 Amount: {{amount}}\n⏰ Pay by: {{payment_deadline}}\n🔗 Pay now: {{payment_link}}\n\nNeed help? Reply here or call {{contact_phone}}.\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','amount','payment_deadline','payment_link','contact_phone','organization_name'],
 ARRAY['payment','reminder','registration']),

('Speaker Confirmation', 'Speaker Allocation', 'pre', 'whatsapp',
 NULL,
 E'Hi {{speaker_name}} 👋\n\nCongratulations! Your speaker slot is confirmed for *{{conference_name}}*! 🎤\n\n📅 Date: {{date}}\n🕐 Your slot: {{session_time}}\n📝 Topic: {{talk_title}}\n\nPlease send us by {{deadline}}:\n• Abstract (250 words)\n• Bio (150 words)\n• Headshot\n• Presentation slides\n\nQuestions? Reply here!\n_{{organization_name}}_',
 ARRAY['speaker_name','conference_name','date','session_time','talk_title','deadline','organization_name'],
 ARRAY['speaker','confirmation']),

('1-Week Reminder', 'WhatsApp Catalogue', 'pre', 'whatsapp',
 NULL,
 E'📢 *{{conference_name}}* is next week!\n\nHi {{recipient_name}} 👋\n\nJust a reminder — you''re registered for *{{conference_name}}* 🎓\n\n📅 Date: {{date}}\n🕐 Time: {{time}}\n📍 {{venue}}\n🔗 Join link: {{meet_link}}\n\nSave this message for easy access!\nSee you there 🙌\n\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','date','time','venue','meet_link','organization_name'],
 ARRAY['reminder','1 week']),

('Day-Before Reminder', 'WhatsApp Catalogue', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}}! 🌟\n\n*{{conference_name}}* is TOMORROW! 🎉\n\n📅 {{date}} | 🕐 {{time}}\n📍 {{venue}}\n🔗 {{meet_link}}\n\nPlease:\n✅ Test your audio/video\n✅ Join 5 min early\n✅ Keep your ID ready\n\nSee you tomorrow! 🚀\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','date','time','venue','meet_link','organization_name'],
 ARRAY['reminder','day before']),

('Abstract Submission CTA', 'Poster & Reels Creation', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}} 👋\n\n📢 *Call for Abstracts — {{conference_name}}*\n\nSubmit your research and get published! 📝\n\n📅 Submission Deadline: {{abstract_deadline}}\n🔗 Submit here: {{submission_link}}\n\nCategories: Original Research, Case Studies, Reviews, Posters\n\nQuestions? Reply here!\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','abstract_deadline','submission_link','organization_name'],
 ARRAY['abstract','submission','call for papers']),

('Google Meet Link Share', 'Google Meet Setup', 'pre', 'whatsapp',
 NULL,
 E'Hi {{recipient_name}} 👋\n\nHere are your *{{conference_name}}* meeting details:\n\n📅 Date: {{date}}\n🕐 Time: {{time}} ({{timezone}})\n🔗 Meeting Link: {{meet_link}}\n🔑 Password: {{password}}\n\nTips:\n✅ Join 5 min early\n✅ Test audio/video beforehand\n✅ Stable internet connection\n\nSee you online! 🎓\n_{{organization_name}}_',
 ARRAY['recipient_name','conference_name','date','time','timezone','meet_link','password','organization_name'],
 ARRAY['google meet','link','virtual']),

-- PRE / SOCIAL
('Conference Announcement Post', 'Running Ad Campaigns', 'pre', 'social',
 NULL,
 E'🎓 Exciting news! We''re thrilled to announce {{conference_name}}!\n\n📅 Date: {{date}}\n📍 {{venue}}\n🌐 Theme: "{{conference_theme}}"\n\nJoin {{participant_count}}+ researchers, clinicians & innovators from across the globe for a day of learning, networking & discovery.\n\n🔗 Register now: {{registration_link}}\n⏰ Early Bird ends: {{early_bird_date}}\n\n#{{hashtag1}} #{{hashtag2}} #Conference #{{organization_hashtag}}',
 ARRAY['conference_name','date','venue','conference_theme','participant_count','registration_link','early_bird_date','hashtag1','hashtag2','organization_hashtag'],
 ARRAY['announcement','promo','social']),

('Keynote Speaker Feature', 'Poster & Reels Creation', 'pre', 'social',
 NULL,
 E'🌟 Meet Our Keynote Speaker!\n\nWe''re honoured to welcome *{{speaker_name}}* as a Keynote Speaker at {{conference_name}}!\n\n🎤 Topic: "{{talk_title}}"\n🏆 {{speaker_designation}}\n🏛️ {{speaker_organization}}\n\n{{speaker_short_bio}}\n\n📅 {{date}} | Register: {{registration_link}}\n\n#KeynoteSpeaker #{{hashtag1}} #{{conference_hashtag}}',
 ARRAY['speaker_name','conference_name','talk_title','speaker_designation','speaker_organization','speaker_short_bio','date','registration_link','hashtag1','conference_hashtag'],
 ARRAY['keynote','speaker','feature']),

('Abstract Submission CTA', 'Poster & Reels Creation', 'pre', 'social',
 NULL,
 E'📢 Call for Abstracts — {{conference_name}}!\n\nShare your research with the world! 🌍\n\n📝 Submit your:\n• Original Research\n• Case Studies\n• Systematic Reviews\n• Poster Presentations\n\n⏰ Deadline: {{abstract_deadline}}\n🔗 Submit: {{submission_link}}\n\nAccepted papers get published with a DOI!\n\n#CallForPapers #Research #{{hashtag1}} #{{conference_hashtag}}',
 ARRAY['conference_name','abstract_deadline','submission_link','hashtag1','conference_hashtag'],
 ARRAY['abstract','call for papers','submission']),

('Early Bird Countdown', 'Running Ad Campaigns', 'pre', 'social',
 NULL,
 E'⏰ {{days_left}} Days Left for Early Bird Registration!\n\nDon''t miss your chance to save {{discount_percentage}}% on {{conference_name}}!\n\n💰 Early Bird: {{early_bird_price}} (ends {{early_bird_date}})\n💰 Regular: {{regular_price}}\n\n🔗 Register now: {{registration_link}}\n\nLimited seats — grab yours before it''s too late! 🏃‍♂️\n\n#EarlyBird #{{conference_hashtag}} #Register #{{hashtag1}}',
 ARRAY['days_left','discount_percentage','conference_name','early_bird_price','early_bird_date','regular_price','registration_link','conference_hashtag','hashtag1'],
 ARRAY['early bird','countdown','discount']),

('Ad Campaign Copy', 'Running Ad Campaigns', 'pre', 'social',
 NULL,
 E'Headline: Join {{conference_name}} — {{date}}\n\nPrimary Text:\nAre you a {{target_audience}} looking to stay updated with the latest in {{field}}? Don''t miss {{conference_name}}!\n\n✅ {{speaker_count}} expert speakers\n✅ {{session_count}} interactive sessions\n✅ Certificate of participation\n✅ Networking with {{participant_count}}+ professionals\n\nEarly bird registration open now!\n\nCTA: Register Now\nURL: {{registration_link}}\n\nDescription: {{conference_name}} | {{date}} | {{venue}}',
 ARRAY['conference_name','date','target_audience','field','speaker_count','session_count','participant_count','registration_link','venue'],
 ARRAY['ad copy','meta','google','campaign']),

-- DURING / EMAIL
('Speaker Session Cue', 'Session Management', 'during', 'email',
 'ACTION REQUIRED: Your Session Starts Soon — {{conference_name}}',
 E'Dear {{speaker_name}},\n\nYour session "{{talk_title}}" is scheduled to begin at {{session_time}} today.\n\nYour Session Details:\n• Session Room/Link: {{room_or_link}}\n• Duration: {{duration}} minutes\n• Moderator: {{moderator_name}}\n\nPlease:\n✓ Join the session 10 minutes early for final setup\n✓ Have your presentation ready to share\n✓ Keep your bio ready for the moderator''s introduction\n\nYour moderator {{moderator_name}} will be in touch if needed.\n\nBest of luck!\n\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['speaker_name','talk_title','session_time','room_or_link','duration','moderator_name','organizer_name','organization_name'],
 ARRAY['speaker','cue','session']),

('Attendance Confirmation', 'Attendance Tracking', 'during', 'email',
 'Attendance Confirmed — {{conference_name}} | {{date}}',
 E'Dear {{participant_name}},\n\nYour attendance at {{conference_name}} has been recorded for {{date}}.\n\nAttendance Record:\n• Sessions Attended: {{sessions_attended}}\n• Registration ID: {{registration_id}}\n• Check-in Time: {{checkin_time}}\n\nYour certificate of participation will be emailed within 48 hours of the event conclusion.\n\nThank you for being part of this conference!\n\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','date','sessions_attended','registration_id','checkin_time','organizer_name','organization_name'],
 ARRAY['attendance','confirmation','registration']),

('YouTube Live Announcement', 'YouTube Live', 'during', 'email',
 'LIVE NOW: {{conference_name}} on YouTube',
 E'Dear {{recipient_name}},\n\n{{conference_name}} is now LIVE on YouTube!\n\nWatch Now: {{youtube_link}}\n\nCurrent Session: {{current_session}}\nSpeaker: {{speaker_name}}\n\nUpcoming Sessions:\n• {{upcoming_session_1}} at {{time_1}}\n• {{upcoming_session_2}} at {{time_2}}\n\nSubscribe to our channel to get notified for all upcoming sessions.\n\nShare this link with your colleagues!\n\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['recipient_name','conference_name','youtube_link','current_session','speaker_name','upcoming_session_1','time_1','upcoming_session_2','time_2','organizer_name','organization_name'],
 ARRAY['youtube','live','streaming']),

('Entry Code for Restricted Session', 'Meeting Restriction', 'during', 'email',
 '{{conference_name}} — Your Entry Code',
 E'Dear {{participant_name}},\n\nWelcome to {{conference_name}}!\n\nYour unique entry code for today''s sessions is below. Please do not share this with others.\n\nEntry Code: {{entry_code}}\n\nHow to use:\n1. Click the meeting link: {{meet_link}}\n2. Enter your entry code when prompted\n3. You will be admitted by the host\n\nSessions requiring this code:\n• {{session_1}} at {{time_1}}\n• {{session_2}} at {{time_2}}\n\nIf you face any issues, contact {{tech_support_email}} immediately.\n\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','entry_code','meet_link','session_1','time_1','session_2','time_2','tech_support_email','organizer_name','organization_name'],
 ARRAY['entry code','restricted','access','security']),

-- DURING / WHATSAPP
('Session Starting Now', 'Session Management', 'during', 'whatsapp',
 NULL,
 E'🔴 *LIVE NOW* — {{conference_name}}\n\nSession: *{{session_title}}*\nSpeaker: {{speaker_name}}\n\n🔗 Join here: {{meet_link}}\n\nDon''t miss it! 👆\n_{{organization_name}}_',
 ARRAY['conference_name','session_title','speaker_name','meet_link','organization_name'],
 ARRAY['live','session','now']),

('Entry Code Share', 'Meeting Restriction', 'during', 'whatsapp',
 NULL,
 E'Hi {{participant_name}} 👋\n\nWelcome to *{{conference_name}}*!\n\nYour entry code: *{{entry_code}}*\n\nUse this code to join the session. Do not share with others.\n\n🔗 Meeting link: {{meet_link}}\n\nNeed help? Reply here.\n_{{organization_name}}_',
 ARRAY['participant_name','conference_name','entry_code','meet_link','organization_name'],
 ARRAY['entry code','access','restricted']),

('Attendance Confirmation', 'Attendance Tracking', 'during', 'whatsapp',
 NULL,
 E'Hi {{participant_name}}! ✅\n\nYour attendance at *{{conference_name}}* has been recorded.\n\n🆔 Registration ID: {{registration_id}}\n📅 Date: {{date}}\n\nYour certificate will be emailed within 48 hrs.\n\nThank you for joining! 🙏\n_{{organization_name}}_',
 ARRAY['participant_name','conference_name','registration_id','date','organization_name'],
 ARRAY['attendance','confirmation']),

('YouTube Live Announcement', 'YouTube Live', 'during', 'whatsapp',
 NULL,
 E'🎬 *{{conference_name}}* is LIVE on YouTube!\n\n📺 Watch now: {{youtube_link}}\n\n🎤 Current Session: *{{current_session}}*\n👤 Speaker: {{speaker_name}}\n\nShare with your colleagues! 🙌\n_{{organization_name}}_',
 ARRAY['conference_name','youtube_link','current_session','speaker_name','organization_name'],
 ARRAY['youtube','live','streaming']),

('Schedule Reminder', 'Session Management', 'during', 'whatsapp',
 NULL,
 E'📋 *{{conference_name}}* — Today''s Schedule\n\n🕐 {{session_1_time}}: {{session_1_title}}\n🕐 {{session_2_time}}: {{session_2_title}}\n🕐 {{session_3_time}}: {{session_3_title}}\n🕑 {{break_time}}: Lunch/Break\n🕐 {{session_4_time}}: {{session_4_title}}\n\n📍 {{venue}}\n🔗 {{meet_link}}\n\n_{{organization_name}}_',
 ARRAY['conference_name','session_1_time','session_1_title','session_2_time','session_2_title','session_3_time','session_3_title','break_time','session_4_time','session_4_title','venue','meet_link','organization_name'],
 ARRAY['schedule','agenda','day-of']),

-- DURING / SOCIAL
('Live Session Announcement', 'YouTube Live', 'during', 'social',
 NULL,
 E'🔴 WE''RE LIVE! {{conference_name}} has officially kicked off!\n\n🎤 Opening session by {{speaker_name}}: "{{talk_title}}"\n\n📺 Watch live: {{youtube_link}}\n💬 Join the conversation in the comments!\n\nFollow along for live updates throughout the day 📲\n\n#Live #{{conference_hashtag}} #{{hashtag1}}',
 ARRAY['conference_name','speaker_name','talk_title','youtube_link','conference_hashtag','hashtag1'],
 ARRAY['live','announcement','streaming']),

('Speaker Quote Card', 'Capture Videos & Screenshots', 'during', 'social',
 NULL,
 E'💬 "{{quote}}"\n— {{speaker_name}}, {{speaker_designation}}\n\n📌 Shared at *{{conference_name}}*, {{date}}\n\nWhich part resonated with you the most? Tell us in the comments! 👇\n\n#{{conference_hashtag}} #Quote #{{hashtag1}}',
 ARRAY['quote','speaker_name','speaker_designation','conference_name','date','conference_hashtag','hashtag1'],
 ARRAY['quote','speaker','highlight']),

('Mid-Event Engagement Post', 'Session Management', 'during', 'social',
 NULL,
 E'We''re halfway through {{conference_name}} and it''s been incredible! 🌟\n\n✅ {{sessions_done}} sessions completed\n🎤 Amazing insights from our speakers\n👥 {{participant_count}}+ participants engaged\n\nComing up next:\n🎤 {{next_speaker}} — "{{next_topic}}"\n\nStill not joined? Catch us live: {{youtube_link}}\n\n#{{conference_hashtag}} #{{hashtag1}}',
 ARRAY['conference_name','sessions_done','participant_count','next_speaker','next_topic','youtube_link','conference_hashtag','hashtag1'],
 ARRAY['mid-event','engagement','update']),

-- POST / EMAIL
('Certificate Delivery', 'Certificate Readiness', 'post', 'email',
 'Your Certificate — {{conference_name}}',
 E'Dear {{participant_name}},\n\nThank you for attending {{conference_name}} on {{date}}.\n\nPlease find attached your Certificate of {{certificate_type}}.\n\nCertificate Details:\n• Name: {{participant_name}}\n• Event: {{conference_name}}\n• Date: {{date}}\n• Certificate Type: {{certificate_type}}\n• Issued by: {{organization_name}}\n\nPlease download and save your certificate. For any corrections, reply to this email within 7 days.\n\nWe hope to see you at our future events!\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','date','certificate_type','organization_name','organizer_name'],
 ARRAY['certificate','post-event']),

('Feedback Collection', 'Participants Feedback Collection', 'post', 'email',
 'Share Your Experience — {{conference_name}} Feedback',
 E'Dear {{participant_name}},\n\nThank you for attending {{conference_name}}! We hope you had an enriching experience.\n\nYour feedback helps us make future events even better.\n\nPlease take 3 minutes to complete our feedback form:\n→ {{feedback_form_link}}\n\nWe''d love to know:\n• Your overall experience rating\n• Most valuable sessions\n• Suggestions for improvement\n• Topics for future conferences\n\nAll responses are anonymous and will be used solely for event improvement.\n\nParticipants who complete the feedback form will receive early access to conference proceedings.\n\nWarm regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','feedback_form_link','organizer_name','organization_name'],
 ARRAY['feedback','post-event','survey']),

('Video Testimonial Request', 'Video Bytes + Consent', 'post', 'email',
 'Share Your Conference Experience — Short Video Request',
 E'Dear {{presenter_name}},\n\nThank you for your excellent presentation at {{conference_name}}. Your session on "{{talk_title}}" was highly appreciated by attendees!\n\nWe''d love to capture your experience in a short 30–60 second video testimonial for our promotional content.\n\nWhat we''d love you to share:\n• Your key takeaway from the conference\n• What you enjoyed most\n• A message for future attendees\n\nHow to submit:\n1. Record a selfie video (landscape mode preferred)\n2. Reply to this email attaching your video (MP4/MOV, max 100MB)\n   OR share via: {{file_share_link}}\n\nConsent: By submitting, you consent to {{organization_name}} using this video for promotional purposes.\n\nDeadline: {{deadline}}\n\nBest regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['presenter_name','conference_name','talk_title','file_share_link','organization_name','deadline','organizer_name'],
 ARRAY['video','testimonial','consent','post-event']),

('Conference Proceedings Published', 'Conference Report', 'post', 'email',
 '{{conference_name}} — Proceedings & DOI Published',
 E'Dear {{participant_name}},\n\nWe are pleased to share that the proceedings of {{conference_name}} have been officially published.\n\nPublication Details:\n• DOI: {{doi_number}}\n• Conference Proceedings: {{proceedings_link}}\n• Published On: {{publication_date}}\n• Indexed by: {{indexing_bodies}}\n\nThe proceedings are now accessible on our website at {{website_link}}.\n\nAuthors: Please use this DOI when citing your presented work.\n\nThank you for your valuable contribution to the conference!\n\nBest regards,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','doi_number','proceedings_link','publication_date','indexing_bodies','website_link','organizer_name','organization_name'],
 ARRAY['proceedings','DOI','publication','post-event']),

('Thank You & Next Event', 'Marketing Team Coordination', 'post', 'email',
 'Thank You for Attending {{conference_name}} — See You Next Time!',
 E'Dear {{participant_name}},\n\nThank you for being part of {{conference_name}} on {{date}}!\n\nThe conference was a tremendous success:\n• {{participant_count}}+ participants from {{country_count}} countries\n• {{session_count}} insightful sessions\n• {{speaker_count}} distinguished speakers\n• {{paper_count}} research papers presented\n\nEvent Highlights Video: {{highlights_link}}\nPhoto Gallery: {{gallery_link}}\n\nStay tuned for our next event — {{next_conference_name}} — coming {{next_conference_date}}!\n\nMark your calendar and register early: {{next_registration_link}}\n\nWith gratitude,\n{{organizer_name}}\n{{organization_name}}',
 ARRAY['participant_name','conference_name','date','participant_count','country_count','session_count','speaker_count','paper_count','highlights_link','gallery_link','next_conference_name','next_conference_date','next_registration_link','organizer_name','organization_name'],
 ARRAY['thank you','next event','highlights','post-event']),

-- POST / WHATSAPP
('Certificate Sent', 'Certificate Readiness', 'post', 'whatsapp',
 NULL,
 E'Hi {{participant_name}} 🎓\n\nYour *Certificate of {{certificate_type}}* for *{{conference_name}}* has been sent to your email!\n\n📧 Check: {{email}}\n\nFor corrections, reply here within 7 days.\n\nThank you for attending! 🙏\n_{{organization_name}}_',
 ARRAY['participant_name','certificate_type','conference_name','email','organization_name'],
 ARRAY['certificate','post-event']),

('Feedback Request', 'Participants Feedback Collection', 'post', 'whatsapp',
 NULL,
 E'Hi {{participant_name}} 👋\n\nThank you for attending *{{conference_name}}*! 🙏\n\nWe''d love your feedback — just 3 minutes! ⏱️\n\n📝 Feedback form: {{feedback_form_link}}\n\nYour input helps us improve future events! 😊\n_{{organization_name}}_',
 ARRAY['participant_name','conference_name','feedback_form_link','organization_name'],
 ARRAY['feedback','survey','post-event']),

('Video Testimonial Request', 'Video Bytes + Consent', 'post', 'whatsapp',
 NULL,
 E'Hi {{presenter_name}} 👋\n\nYour presentation at *{{conference_name}}* was fantastic! 🌟\n\nWould you share a quick 30–60 sec video about your experience?\n\n📹 Record and send here, or upload to:\n{{file_share_link}}\n\nYour testimonial will be featured in our highlights! 🎬\n_{{organization_name}}_',
 ARRAY['presenter_name','conference_name','file_share_link','organization_name'],
 ARRAY['video','testimonial','post-event']),

('Highlights Reel Share', 'Marketing Team Coordination', 'post', 'whatsapp',
 NULL,
 E'🎬 *{{conference_name}}* Highlights are LIVE!\n\nWatch the best moments from our conference:\n📺 {{highlights_link}}\n\nThank you to all {{participant_count}}+ participants, speakers & organizers!\n\nSee you at the next event 🚀\n_{{organization_name}}_',
 ARRAY['conference_name','highlights_link','participant_count','organization_name'],
 ARRAY['highlights','reel','post-event']),

('Proceedings Published', 'Conference Report', 'post', 'whatsapp',
 NULL,
 E'Hi {{participant_name}} 👋\n\nGreat news! *{{conference_name}}* proceedings are now published! 📄\n\n🔗 DOI: {{doi_number}}\n📚 Access here: {{proceedings_link}}\n\nCite your work using the DOI above.\n\nThank you for contributing! 🙏\n_{{organization_name}}_',
 ARRAY['participant_name','conference_name','doi_number','proceedings_link','organization_name'],
 ARRAY['proceedings','DOI','publication','post-event']),

('Thank You & Next Event', 'Marketing Team Coordination', 'post', 'whatsapp',
 NULL,
 E'Hi {{participant_name}} 🙏\n\nThank you for being part of *{{conference_name}}*!\n\n🎬 Highlights: {{highlights_link}}\n📸 Photo Gallery: {{gallery_link}}\n\n📢 Save the date for our next event:\n*{{next_conference_name}}* — {{next_conference_date}}\n🔗 Register early: {{next_registration_link}}\n\nSee you there! 🚀\n_{{organization_name}}_',
 ARRAY['participant_name','conference_name','highlights_link','gallery_link','next_conference_name','next_conference_date','next_registration_link','organization_name'],
 ARRAY['thank you','next event','post-event']),

-- POST / SOCIAL
('Thank You Post', 'Marketing Team Coordination', 'post', 'social',
 NULL,
 E'🙏 A huge THANK YOU to everyone who made {{conference_name}} an unforgettable experience!\n\n✅ {{participant_count}}+ participants\n✅ {{speaker_count}} incredible speakers\n✅ {{session_count}} powerful sessions\n✅ {{country_count}} countries represented\n\nIt was an honour to host such a vibrant community of {{field}} professionals. 🌍\n\n📸 Check out the highlights: {{highlights_link}}\n\nUntil next time! 💙\n\n#ThankYou #{{conference_hashtag}} #{{hashtag1}}',
 ARRAY['conference_name','participant_count','speaker_count','session_count','country_count','field','highlights_link','conference_hashtag','hashtag1'],
 ARRAY['thank you','post-event','wrap-up']),

('Highlights Reel Caption', 'Marketing Team Coordination', 'post', 'social',
 NULL,
 E'🎬 Relive the magic of {{conference_name}}!\n\nFrom keynote addresses to breakthrough research presentations — every moment was inspiring. ✨\n\nWatch our highlights reel: {{highlights_link}}\n\nTag someone who attended with you! 👇\n\n#Highlights #{{conference_hashtag}} #{{hashtag1}}',
 ARRAY['conference_name','highlights_link','conference_hashtag','hashtag1'],
 ARRAY['highlights','reel','post-event']),

('Certificate Achievement Post', 'Certificate Readiness', 'post', 'social',
 NULL,
 E'🎓 Certificates are OUT!\n\nCongratulations to all {{participant_count}}+ participants of {{conference_name}} who have now received their certificates!\n\nCheck your email inbox 📧\n\nNot received? Reply or DM us with your registration ID.\n\n#Congratulations #Certificate #{{conference_hashtag}}',
 ARRAY['participant_count','conference_name','conference_hashtag'],
 ARRAY['certificate','achievement','post-event']),

('Proceedings Published Post', 'Conference Report', 'post', 'social',
 NULL,
 E'📚 {{conference_name}} Proceedings are now PUBLISHED!\n\n🔗 DOI: {{doi_number}}\n📄 Access the full proceedings: {{proceedings_link}}\n\nAll presented research is now officially indexed and citable. Congratulations to all contributing authors! 🎉\n\n#ResearchPublished #DOI #{{conference_hashtag}} #{{hashtag1}}',
 ARRAY['conference_name','doi_number','proceedings_link','conference_hashtag','hashtag1'],
 ARRAY['proceedings','publication','research','post-event']),

('Feedback Appreciation Post', 'Participants Feedback Collection', 'post', 'social',
 NULL,
 E'💬 Your voices have been heard!\n\nThank you to everyone who took the time to share feedback on {{conference_name}}. 🙏\n\n📊 Overall Satisfaction: {{satisfaction_score}}/5\n💡 Top suggestion: {{top_suggestion}}\n\nWe''re already working on making the next event even better! Stay tuned for {{next_conference_name}} 📢\n\n#Feedback #Community #{{conference_hashtag}}',
 ARRAY['conference_name','satisfaction_score','top_suggestion','next_conference_name','conference_hashtag'],
 ARRAY['feedback','community','post-event']);
