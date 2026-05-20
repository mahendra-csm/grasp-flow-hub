export type Channel = "email" | "whatsapp" | "social";
export type Phase = "pre" | "during" | "post";

export interface ConferenceTemplate {
  id: string;
  title: string;
  activity: string;
  phase: Phase;
  channel: Channel;
  subject?: string; // email subject line
  body: string;
  variables: string[];
  tags: string[];
  charCount?: number; // auto-calculated
}

const tpl = (
  id: string,
  title: string,
  activity: string,
  phase: Phase,
  channel: Channel,
  body: string,
  variables: string[],
  tags: string[],
  subject?: string,
): ConferenceTemplate => ({
  id,
  title,
  activity,
  phase,
  channel,
  subject,
  body,
  variables,
  tags,
  charCount: body.length,
});

export const conferenceTemplates: ConferenceTemplate[] = [
  // ─── PRE-EVENT / EMAIL ────────────────────────────────────────────────────
  tpl(
    "pre-email-01",
    "Registration Invite",
    "Email Marketing",
    "pre",
    "email",
    `Dear {{recipient_name}},

We are delighted to invite you to attend {{conference_name}}, scheduled on {{date}} at {{venue}}.

This premier conference brings together leading experts, researchers, and practitioners in {{field}} to share insights, innovations, and best practices.

Event Highlights:
• Keynote addresses by renowned speakers
• Paper & abstract presentations
• Panel discussions & workshops
• Networking opportunities

Registration Details:
• Early Bird Deadline: {{early_bird_date}}
• Regular Registration Deadline: {{registration_deadline}}
• Registration Link: {{registration_link}}

Secure your spot today and join hundreds of professionals shaping the future of {{field}}.

For queries, contact us at {{contact_email}} or call {{contact_phone}}.

Warm regards,
{{organizer_name}}
{{organization_name}}
{{website}}`,
    ["recipient_name","conference_name","date","venue","field","early_bird_date","registration_deadline","registration_link","contact_email","contact_phone","organizer_name","organization_name","website"],
    ["invite","registration","marketing"],
    "You're Invited: {{conference_name}} | {{date}}",
  ),

  tpl(
    "pre-email-02",
    "Early Bird Offer",
    "Email Marketing",
    "pre",
    "email",
    `Dear {{recipient_name}},

Early bird registration for {{conference_name}} closes on {{early_bird_date}}!

Save {{discount_percentage}}% on your registration fee when you register before the deadline.

Early Bird Price: {{early_bird_price}} (Regular: {{regular_price}})

Don't miss this opportunity to:
✓ Connect with {{participant_count}}+ industry leaders
✓ Access cutting-edge research presentations
✓ Participate in interactive workshops
✓ Earn CPD/CME credits

Register Now: {{registration_link}}

This offer expires at midnight on {{early_bird_date}}.

Best regards,
{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","early_bird_date","discount_percentage","early_bird_price","regular_price","participant_count","registration_link","organizer_name","organization_name"],
    ["early bird","discount","registration","marketing"],
    "Last Chance: Early Bird Discount for {{conference_name}}!",
  ),

  tpl(
    "pre-email-03",
    "Past Conference Highlights",
    "Email Marketing",
    "pre",
    "email",
    `Dear {{recipient_name}},

As we gear up for {{conference_name}} on {{date}}, we'd like to share some highlights from our previous edition.

Last Year's Highlights:
• {{past_participant_count}}+ attendees from {{country_count}} countries
• {{speaker_count}} distinguished speakers
• {{paper_count}} research papers presented
• {{highlight_1}}
• {{highlight_2}}

This year, we're raising the bar even higher!

Be part of {{conference_name}} — the leading platform for {{field}} professionals.

Register Here: {{registration_link}}
Early Bird Ends: {{early_bird_date}}

We look forward to welcoming you!

Warm regards,
{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","date","past_participant_count","country_count","speaker_count","paper_count","highlight_1","highlight_2","field","registration_link","early_bird_date","organizer_name","organization_name"],
    ["highlights","past event","marketing"],
    "{{conference_name}} — See What You Missed Last Year",
  ),

  tpl(
    "pre-email-04",
    "Leads Follow-up",
    "Leads Follow-up",
    "pre",
    "email",
    `Dear {{recipient_name}},

Thank you for your interest in {{conference_name}} on {{date}}.

We noticed you haven't completed your registration yet. We wanted to reach out personally to answer any questions you might have.

Quick Registration: {{registration_link}}

If you have concerns about:
• Fees/Payment — We offer flexible payment options
• Topics — View our full agenda at {{agenda_link}}
• Technical requirements — Our support team is here to help

Please reply to this email or contact us at {{contact_email}}.

We look forward to seeing you there!

Warm regards,
{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","date","registration_link","agenda_link","contact_email","organizer_name","organization_name"],
    ["follow-up","leads","conversion"],
    "Following Up: {{conference_name}} Registration",
  ),

  tpl(
    "pre-email-05",
    "Abstract Submission CTA",
    "Poster & Reels Creation",
    "pre",
    "email",
    `Dear {{recipient_name}},

We invite you to submit your original research for presentation at {{conference_name}} on {{date}}.

Submission Categories:
• Original Research Papers
• Case Studies
• Systematic Reviews
• Poster Presentations

Submission Guidelines:
• Word limit: {{word_limit}} words
• Format: {{format}}
• Deadline: {{abstract_deadline}}
• Submit at: {{submission_link}}

Accepted abstracts will be published in the conference proceedings with a DOI. Selected papers will be considered for journal publication.

Submit your abstract today: {{submission_link}}

For queries: {{review_email}}

Best regards,
{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","date","word_limit","format","abstract_deadline","submission_link","review_email","organizer_name","organization_name"],
    ["abstract","submission","call for papers"],
    "Call for Abstracts — {{conference_name}} | Deadline: {{abstract_deadline}}",
  ),

  tpl(
    "pre-email-06",
    "Abstract Received Confirmation",
    "Abstract Review",
    "pre",
    "email",
    `Dear {{author_name}},

Thank you for submitting your abstract "{{abstract_title}}" for {{conference_name}}.

Submission ID: {{submission_id}}
Submitted On: {{submission_date}}

What happens next:
1. Your abstract will undergo peer review by our expert committee
2. Review results will be communicated by {{review_deadline}}
3. Accepted abstracts will receive presentation slot details

For queries regarding your submission, contact {{review_email}} with your Submission ID.

Thank you for contributing to the advancement of {{field}}.

Best regards,
{{review_committee_name}}
{{conference_name}} Organizing Committee`,
    ["author_name","abstract_title","conference_name","submission_id","submission_date","review_deadline","review_email","field","review_committee_name"],
    ["abstract","confirmation","review"],
    "Abstract Submission Received — {{conference_name}} | ID: {{submission_id}}",
  ),

  tpl(
    "pre-email-07",
    "Speaker Confirmation & Requirements",
    "Speaker Allocation",
    "pre",
    "email",
    `Dear {{speaker_name}},

We are pleased to confirm your participation as a speaker at {{conference_name}} on {{date}}.

Your Session Details:
• Topic: {{talk_title}}
• Date & Time: {{session_date_time}}
• Duration: {{duration}} minutes (including Q&A)
• Session Room/Link: {{room_or_link}}

Action Required — Please send us by {{deadline}}:
☐ Final presentation title and abstract (250 words)
☐ Your professional bio (150 words)
☐ High-resolution headshot (JPG/PNG, min 300 DPI)
☐ Final presentation slides (PowerPoint/PDF)

Technical Setup:
We will conduct a tech rehearsal on {{rehearsal_date}} at {{rehearsal_time}}.
Rehearsal Link: {{rehearsal_link}}

Please confirm your availability by replying to this email.

Looking forward to your valuable contribution!

Best regards,
{{organizer_name}}
{{organization_name}}`,
    ["speaker_name","conference_name","date","talk_title","session_date_time","duration","room_or_link","deadline","rehearsal_date","rehearsal_time","rehearsal_link","organizer_name","organization_name"],
    ["speaker","confirmation","requirements"],
    "Speaker Confirmation — {{conference_name}} | {{date}}",
  ),

  tpl(
    "pre-email-08",
    "Google Meet Details",
    "Google Meet Setup",
    "pre",
    "email",
    `Dear {{recipient_name}},

Your meeting details for {{conference_name}} are ready.

Meeting Details:
• Date: {{date}}
• Time: {{time}} ({{timezone}})
• Meeting Link: {{meet_link}}
• Meeting ID: {{meeting_id}}
• Password: {{password}}

Before the meeting, please:
✓ Test your audio and video
✓ Use a stable internet connection
✓ Join 5 minutes early
✓ Keep your microphone muted when not speaking
✓ Use a quiet, well-lit location

For technical support, contact {{tech_support_email}}.

See you online!

{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","date","time","timezone","meet_link","meeting_id","password","tech_support_email","organizer_name","organization_name"],
    ["google meet","virtual","setup","link"],
    "{{conference_name}} — Meeting Link & Access Details",
  ),

  tpl(
    "pre-email-09",
    "Keynote Speaker Profile Request",
    "Keynote Speaker Prep",
    "pre",
    "email",
    `Dear {{speaker_name}},

Congratulations on being selected as a Keynote Speaker at {{conference_name}} on {{date}}!

To help us showcase your expertise to our audience, we kindly request the following by {{deadline}}:

1. Keynote Topic & Title
   Please confirm/suggest your keynote topic aligned with the theme: "{{conference_theme}}"

2. Abstract (300 words)
   A brief overview of your keynote presentation

3. Speaker Profile
   • Professional bio (200 words)
   • Current designation & organization
   • LinkedIn profile URL
   • Website/portfolio URL (if any)

4. Photo
   • High-resolution professional headshot
   • Minimum 1MB, JPG/PNG format

5. Presentation Slides
   • Format: PowerPoint (.pptx) or PDF
   • Due date: {{slides_deadline}}

Please send all materials to {{organizer_email}}.

We are honoured to have you with us and look forward to an inspiring keynote!

Warm regards,
{{organizer_name}}
{{organization_name}}`,
    ["speaker_name","conference_name","date","deadline","conference_theme","slides_deadline","organizer_email","organizer_name","organization_name"],
    ["keynote","speaker","profile","materials"],
    "Keynote Speaker Profile Request — {{conference_name}}",
  ),

  // ─── PRE-EVENT / WHATSAPP ──────────────────────────────────────────────────
  tpl(
    "pre-wa-01",
    "Registration Invite",
    "Email Marketing",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}}! 👋

You're invited to *{{conference_name}}* 🎓

📅 Date: {{date}}
📍 Venue: {{venue}}
🔗 Register: {{registration_link}}

Early bird ends {{early_bird_date}}. Limited seats!

For queries: {{contact_phone}}
_{{organization_name}}_`,
    ["recipient_name","conference_name","date","venue","registration_link","early_bird_date","contact_phone","organization_name"],
    ["invite","registration"],
  ),

  tpl(
    "pre-wa-02",
    "Early Bird Reminder",
    "WhatsApp Catalogue",
    "pre",
    "whatsapp",
    `⏰ *Early Bird Ends {{early_bird_date}}!*

Hi {{recipient_name}},

Don't miss {{discount_percentage}}% off on *{{conference_name}}* registration!

💰 Early Bird: {{early_bird_price}}
💰 Regular: {{regular_price}}

👆 Register: {{registration_link}}

Hurry, offer expires at midnight!
_{{organization_name}}_`,
    ["recipient_name","early_bird_date","discount_percentage","conference_name","early_bird_price","regular_price","registration_link","organization_name"],
    ["early bird","discount","reminder"],
  ),

  tpl(
    "pre-wa-03",
    "Leads Follow-up",
    "Leads Follow-up",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}} 👋

We noticed you were interested in *{{conference_name}}* on {{date}}.

Have any questions? We're happy to help! 😊

📝 Register: {{registration_link}}
📞 Call/WhatsApp: {{contact_phone}}
📧 Email: {{contact_email}}

See you there! 🎉
_{{organization_name}}_`,
    ["recipient_name","conference_name","date","registration_link","contact_phone","contact_email","organization_name"],
    ["follow-up","leads"],
  ),

  tpl(
    "pre-wa-04",
    "Payment Reminder",
    "WhatsApp Catalogue",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}} 👋

Friendly reminder: Your registration for *{{conference_name}}* is pending payment.

💳 Amount: {{amount}}
⏰ Pay by: {{payment_deadline}}
🔗 Pay now: {{payment_link}}

Need help? Reply here or call {{contact_phone}}.
_{{organization_name}}_`,
    ["recipient_name","conference_name","amount","payment_deadline","payment_link","contact_phone","organization_name"],
    ["payment","reminder","registration"],
  ),

  tpl(
    "pre-wa-05",
    "Speaker Confirmation",
    "Speaker Allocation",
    "pre",
    "whatsapp",
    `Hi {{speaker_name}} 👋

Congratulations! Your speaker slot is confirmed for *{{conference_name}}*! 🎤

📅 Date: {{date}}
🕐 Your slot: {{session_time}}
📝 Topic: {{talk_title}}

Please send us by {{deadline}}:
• Abstract (250 words)
• Bio (150 words)
• Headshot
• Presentation slides

Questions? Reply here!
_{{organization_name}}_`,
    ["speaker_name","conference_name","date","session_time","talk_title","deadline","organization_name"],
    ["speaker","confirmation"],
  ),

  tpl(
    "pre-wa-06",
    "1-Week Reminder",
    "WhatsApp Catalogue",
    "pre",
    "whatsapp",
    `📢 *{{conference_name}}* is next week!

Hi {{recipient_name}} 👋

Just a reminder — you're registered for *{{conference_name}}* 🎓

📅 Date: {{date}}
🕐 Time: {{time}}
📍 {{venue}}
🔗 Join link: {{meet_link}}

Save this message for easy access!
See you there 🙌

_{{organization_name}}_`,
    ["recipient_name","conference_name","date","time","venue","meet_link","organization_name"],
    ["reminder","1 week"],
  ),

  tpl(
    "pre-wa-07",
    "Day-Before Reminder",
    "WhatsApp Catalogue",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}}! 🌟

*{{conference_name}}* is TOMORROW! 🎉

📅 {{date}} | 🕐 {{time}}
📍 {{venue}}
🔗 {{meet_link}}

Please:
✅ Test your audio/video
✅ Join 5 min early
✅ Keep your ID ready

See you tomorrow! 🚀
_{{organization_name}}_`,
    ["recipient_name","conference_name","date","time","venue","meet_link","organization_name"],
    ["reminder","day before"],
  ),

  tpl(
    "pre-wa-08",
    "Abstract Submission CTA",
    "Poster & Reels Creation",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}} 👋

📢 *Call for Abstracts — {{conference_name}}*

Submit your research and get published! 📝

📅 Submission Deadline: {{abstract_deadline}}
🔗 Submit here: {{submission_link}}

Categories: Original Research, Case Studies, Reviews, Posters

Questions? Reply here!
_{{organization_name}}_`,
    ["recipient_name","conference_name","abstract_deadline","submission_link","organization_name"],
    ["abstract","submission","call for papers"],
  ),

  tpl(
    "pre-wa-09",
    "Telegram Channel Invite",
    "Telegram Catalogue",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}} 👋

Join our official *{{conference_name}}* Telegram channel for live updates, schedule, and announcements!

📲 Join here: {{telegram_link}}

Stay connected and get real-time updates before and during the event.

_{{organization_name}}_`,
    ["recipient_name","conference_name","telegram_link","organization_name"],
    ["telegram","channel","invite"],
  ),

  tpl(
    "pre-wa-10",
    "Google Meet Link Share",
    "Google Meet Setup",
    "pre",
    "whatsapp",
    `Hi {{recipient_name}} 👋

Here are your *{{conference_name}}* meeting details:

📅 Date: {{date}}
🕐 Time: {{time}} ({{timezone}})
🔗 Meeting Link: {{meet_link}}
🔑 Password: {{password}}

Tips:
✅ Join 5 min early
✅ Test audio/video beforehand
✅ Stable internet connection

See you online! 🎓
_{{organization_name}}_`,
    ["recipient_name","conference_name","date","time","timezone","meet_link","password","organization_name"],
    ["google meet","link","virtual"],
  ),

  // ─── PRE-EVENT / SOCIAL MEDIA ─────────────────────────────────────────────
  tpl(
    "pre-social-01",
    "Conference Announcement Post",
    "Running Ad Campaigns",
    "pre",
    "social",
    `🎓 Exciting news! We're thrilled to announce {{conference_name}}!

📅 Date: {{date}}
📍 {{venue}}
🌐 Theme: "{{conference_theme}}"

Join {{participant_count}}+ researchers, clinicians & innovators from across the globe for a day of learning, networking & discovery.

🔗 Register now: {{registration_link}}
⏰ Early Bird ends: {{early_bird_date}}

#{{hashtag1}} #{{hashtag2}} #Conference #{{organization_hashtag}}`,
    ["conference_name","date","venue","conference_theme","participant_count","registration_link","early_bird_date","hashtag1","hashtag2","organization_hashtag"],
    ["announcement","promo","social"],
  ),

  tpl(
    "pre-social-02",
    "Keynote Speaker Feature",
    "Poster & Reels Creation",
    "pre",
    "social",
    `🌟 Meet Our Keynote Speaker!

We're honoured to welcome *{{speaker_name}}* as a Keynote Speaker at {{conference_name}}!

🎤 Topic: "{{talk_title}}"
🏆 {{speaker_designation}}
🏛️ {{speaker_organization}}

{{speaker_short_bio}}

📅 {{date}} | Register: {{registration_link}}

#KeynoteSpeaker #{{hashtag1}} #{{conference_hashtag}}`,
    ["speaker_name","conference_name","talk_title","speaker_designation","speaker_organization","speaker_short_bio","date","registration_link","hashtag1","conference_hashtag"],
    ["keynote","speaker","feature"],
  ),

  tpl(
    "pre-social-03",
    "Abstract Submission CTA",
    "Poster & Reels Creation",
    "pre",
    "social",
    `📢 Call for Abstracts — {{conference_name}}!

Share your research with the world! 🌍

📝 Submit your:
• Original Research
• Case Studies
• Systematic Reviews
• Poster Presentations

⏰ Deadline: {{abstract_deadline}}
🔗 Submit: {{submission_link}}

Accepted papers get published with a DOI!

#CallForPapers #Research #{{hashtag1}} #{{conference_hashtag}}`,
    ["conference_name","abstract_deadline","submission_link","hashtag1","conference_hashtag"],
    ["abstract","call for papers","submission"],
  ),

  tpl(
    "pre-social-04",
    "Early Bird Countdown",
    "Running Ad Campaigns",
    "pre",
    "social",
    `⏰ {{days_left}} Days Left for Early Bird Registration!

Don't miss your chance to save {{discount_percentage}}% on {{conference_name}}!

💰 Early Bird: {{early_bird_price}} (ends {{early_bird_date}})
💰 Regular: {{regular_price}}

🔗 Register now: {{registration_link}}

Limited seats — grab yours before it's too late! 🏃‍♂️

#EarlyBird #{{conference_hashtag}} #Register #{{hashtag1}}`,
    ["days_left","discount_percentage","conference_name","early_bird_price","early_bird_date","regular_price","registration_link","conference_hashtag","hashtag1"],
    ["early bird","countdown","discount"],
  ),

  tpl(
    "pre-social-05",
    "Ad Campaign Copy (Meta/Google)",
    "Running Ad Campaigns",
    "pre",
    "social",
    `Headline: Join {{conference_name}} — {{date}}

Primary Text:
Are you a {{target_audience}} looking to stay updated with the latest in {{field}}? Don't miss {{conference_name}}!

✅ {{speaker_count}} expert speakers
✅ {{session_count}} interactive sessions
✅ Certificate of participation
✅ Networking with {{participant_count}}+ professionals

Early bird registration open now!

CTA: Register Now
URL: {{registration_link}}

Description: {{conference_name}} | {{date}} | {{venue}}`,
    ["conference_name","date","target_audience","field","speaker_count","session_count","participant_count","registration_link","venue"],
    ["ad copy","meta","google","campaign"],
  ),

  // ─── DURING-EVENT / EMAIL ─────────────────────────────────────────────────
  tpl(
    "during-email-01",
    "Speaker Session Cue",
    "Session Management",
    "during",
    "email",
    `Dear {{speaker_name}},

Your session "{{talk_title}}" is scheduled to begin at {{session_time}} today.

Your Session Details:
• Session Room/Link: {{room_or_link}}
• Duration: {{duration}} minutes
• Moderator: {{moderator_name}}

Please:
✓ Join the session 10 minutes early for final setup
✓ Have your presentation ready to share
✓ Keep your bio ready for the moderator's introduction

Your moderator {{moderator_name}} will be in touch if needed.

Best of luck!

{{organizer_name}}
{{organization_name}}`,
    ["speaker_name","talk_title","session_time","room_or_link","duration","moderator_name","organizer_name","organization_name"],
    ["speaker","cue","session"],
    "ACTION REQUIRED: Your Session Starts in {{time_until}} — {{conference_name}}",
  ),

  tpl(
    "during-email-02",
    "Attendance Confirmation",
    "Attendance Tracking",
    "during",
    "email",
    `Dear {{participant_name}},

Your attendance at {{conference_name}} has been recorded for {{date}}.

Attendance Record:
• Sessions Attended: {{sessions_attended}}
• Registration ID: {{registration_id}}
• Check-in Time: {{checkin_time}}

Your certificate of participation will be emailed within 48 hours of the event conclusion.

Thank you for being part of this conference!

{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","date","sessions_attended","registration_id","checkin_time","organizer_name","organization_name"],
    ["attendance","confirmation","registration"],
    "Attendance Confirmed — {{conference_name}} | {{date}}",
  ),

  tpl(
    "during-email-03",
    "YouTube Live Announcement",
    "YouTube Live",
    "during",
    "email",
    `Dear {{recipient_name}},

{{conference_name}} is now LIVE on YouTube!

Watch Now: {{youtube_link}}

Current Session: {{current_session}}
Speaker: {{speaker_name}}

Upcoming Sessions:
• {{upcoming_session_1}} at {{time_1}}
• {{upcoming_session_2}} at {{time_2}}

Subscribe to our channel to get notified for all upcoming sessions.

Share this link with your colleagues!

{{organizer_name}}
{{organization_name}}`,
    ["recipient_name","conference_name","youtube_link","current_session","speaker_name","upcoming_session_1","time_1","upcoming_session_2","time_2","organizer_name","organization_name"],
    ["youtube","live","streaming"],
    "LIVE NOW: {{conference_name}} on YouTube",
  ),

  tpl(
    "during-email-04",
    "Entry Code for Restricted Session",
    "Meeting Restriction",
    "during",
    "email",
    `Dear {{participant_name}},

Welcome to {{conference_name}}!

Your unique entry code for today's sessions is below. Please do not share this with others.

Entry Code: {{entry_code}}

How to use:
1. Click the meeting link: {{meet_link}}
2. Enter your entry code when prompted
3. You will be admitted by the host

Sessions requiring this code:
• {{session_1}} at {{time_1}}
• {{session_2}} at {{time_2}}

If you face any issues, contact {{tech_support_email}} immediately.

{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","entry_code","meet_link","session_1","time_1","session_2","time_2","tech_support_email","organizer_name","organization_name"],
    ["entry code","restricted","access","security"],
    "{{conference_name}} — Your Entry Code",
  ),

  // ─── DURING-EVENT / WHATSAPP ───────────────────────────────────────────────
  tpl(
    "during-wa-01",
    "Session Starting Now",
    "Session Management",
    "during",
    "whatsapp",
    `🔴 *LIVE NOW* — {{conference_name}}

Session: *{{session_title}}*
Speaker: {{speaker_name}}

🔗 Join here: {{meet_link}}

Don't miss it! 👆
_{{organization_name}}_`,
    ["conference_name","session_title","speaker_name","meet_link","organization_name"],
    ["live","session","now"],
  ),

  tpl(
    "during-wa-02",
    "Entry Code Share",
    "Meeting Restriction",
    "during",
    "whatsapp",
    `Hi {{participant_name}} 👋

Welcome to *{{conference_name}}*!

Your entry code: *{{entry_code}}*

Use this code to join the session. Do not share with others.

🔗 Meeting link: {{meet_link}}

Need help? Reply here.
_{{organization_name}}_`,
    ["participant_name","conference_name","entry_code","meet_link","organization_name"],
    ["entry code","access","restricted"],
  ),

  tpl(
    "during-wa-03",
    "Attendance Confirmation",
    "Attendance Tracking",
    "during",
    "whatsapp",
    `Hi {{participant_name}}! ✅

Your attendance at *{{conference_name}}* has been recorded.

🆔 Registration ID: {{registration_id}}
📅 Date: {{date}}

Your certificate will be emailed within 48 hrs.

Thank you for joining! 🙏
_{{organization_name}}_`,
    ["participant_name","conference_name","registration_id","date","organization_name"],
    ["attendance","confirmation"],
  ),

  tpl(
    "during-wa-04",
    "YouTube Live Announcement",
    "YouTube Live",
    "during",
    "whatsapp",
    `🎬 *{{conference_name}}* is LIVE on YouTube!

📺 Watch now: {{youtube_link}}

🎤 Current Session: *{{current_session}}*
👤 Speaker: {{speaker_name}}

Share with your colleagues! 🙌
_{{organization_name}}_`,
    ["conference_name","youtube_link","current_session","speaker_name","organization_name"],
    ["youtube","live","streaming"],
  ),

  tpl(
    "during-wa-05",
    "Schedule Reminder",
    "Session Management",
    "during",
    "whatsapp",
    `📋 *{{conference_name}}* — Today's Schedule

🕐 {{session_1_time}}: {{session_1_title}}
🕐 {{session_2_time}}: {{session_2_title}}
🕐 {{session_3_time}}: {{session_3_title}}
🕑 {{break_time}}: Lunch/Break
🕐 {{session_4_time}}: {{session_4_title}}

📍 {{venue}}
🔗 {{meet_link}}

_{{organization_name}}_`,
    ["conference_name","session_1_time","session_1_title","session_2_time","session_2_title","session_3_time","session_3_title","break_time","session_4_time","session_4_title","venue","meet_link","organization_name"],
    ["schedule","agenda","day-of"],
  ),

  // ─── DURING-EVENT / SOCIAL MEDIA ──────────────────────────────────────────
  tpl(
    "during-social-01",
    "Live Session Announcement",
    "YouTube Live",
    "during",
    "social",
    `🔴 WE'RE LIVE! {{conference_name}} has officially kicked off!

🎤 Opening session by {{speaker_name}}: "{{talk_title}}"

📺 Watch live: {{youtube_link}}
💬 Join the conversation in the comments!

Follow along for live updates throughout the day 📲

#Live #{{conference_hashtag}} #{{hashtag1}}`,
    ["conference_name","speaker_name","talk_title","youtube_link","conference_hashtag","hashtag1"],
    ["live","announcement","streaming"],
  ),

  tpl(
    "during-social-02",
    "Speaker Quote Card",
    "Capture Videos & Screenshots",
    "during",
    "social",
    `💬 "{{quote}}"
— {{speaker_name}}, {{speaker_designation}}

📌 Shared at *{{conference_name}}*, {{date}}

Which part resonated with you the most? Tell us in the comments! 👇

#{{conference_hashtag}} #Quote #{{hashtag1}}`,
    ["quote","speaker_name","speaker_designation","conference_name","date","conference_hashtag","hashtag1"],
    ["quote","speaker","highlight"],
  ),

  tpl(
    "during-social-03",
    "Mid-Event Engagement Post",
    "Session Management",
    "during",
    "social",
    `We're halfway through {{conference_name}} and it's been incredible! 🌟

✅ {{sessions_done}} sessions completed
🎤 Amazing insights from our speakers
👥 {{participant_count}}+ participants engaged

Coming up next:
🎤 {{next_speaker}} — "{{next_topic}}"

Still not joined? Catch us live: {{youtube_link}}

#{{conference_hashtag}} #{{hashtag1}}`,
    ["conference_name","sessions_done","participant_count","next_speaker","next_topic","youtube_link","conference_hashtag","hashtag1"],
    ["mid-event","engagement","update"],
  ),

  // ─── POST-EVENT / EMAIL ───────────────────────────────────────────────────
  tpl(
    "post-email-01",
    "Certificate Delivery",
    "Certificate Readiness",
    "post",
    "email",
    `Dear {{participant_name}},

Thank you for attending {{conference_name}} on {{date}}.

Please find attached your Certificate of {{certificate_type}}.

Certificate Details:
• Name: {{participant_name}}
• Event: {{conference_name}}
• Date: {{date}}
• Certificate Type: {{certificate_type}}
• Issued by: {{organization_name}}

Please download and save your certificate. For any corrections, reply to this email within 7 days.

We hope to see you at our future events!

Warm regards,
{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","date","certificate_type","organization_name","organizer_name"],
    ["certificate","post-event"],
    "Your Certificate — {{conference_name}}",
  ),

  tpl(
    "post-email-02",
    "Feedback Collection",
    "Participants Feedback Collection",
    "post",
    "email",
    `Dear {{participant_name}},

Thank you for attending {{conference_name}}! We hope you had an enriching experience.

Your feedback helps us make future events even better.

Please take 3 minutes to complete our feedback form:
→ {{feedback_form_link}}

We'd love to know:
• Your overall experience rating
• Most valuable sessions
• Suggestions for improvement
• Topics for future conferences

All responses are anonymous and will be used solely for event improvement.

Participants who complete the feedback form will receive early access to conference proceedings.

Warm regards,
{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","feedback_form_link","organizer_name","organization_name"],
    ["feedback","post-event","survey"],
    "Share Your Experience — {{conference_name}} Feedback",
  ),

  tpl(
    "post-email-03",
    "Video Testimonial Request",
    "Video Bytes + Consent",
    "post",
    "email",
    `Dear {{presenter_name}},

Thank you for your excellent presentation at {{conference_name}}. Your session on "{{talk_title}}" was highly appreciated by attendees!

We'd love to capture your experience in a short 30–60 second video testimonial for our promotional content.

What we'd love you to share:
• Your key takeaway from the conference
• What you enjoyed most
• A message for future attendees

How to submit:
1. Record a selfie video (landscape mode preferred)
2. Reply to this email attaching your video (MP4/MOV, max 100MB)
   OR share via: {{file_share_link}}

Consent: By submitting, you consent to {{organization_name}} using this video for promotional purposes. Your contribution will be credited appropriately.

Deadline for submission: {{deadline}}

Thank you!

Best regards,
{{organizer_name}}
{{organization_name}}`,
    ["presenter_name","conference_name","talk_title","file_share_link","organization_name","deadline","organizer_name"],
    ["video","testimonial","consent","post-event"],
    "Share Your Conference Experience — Short Video Request",
  ),

  tpl(
    "post-email-04",
    "Conference Proceedings Published",
    "Conference Report",
    "post",
    "email",
    `Dear {{participant_name}},

We are pleased to share that the proceedings of {{conference_name}} have been officially published.

Publication Details:
• DOI: {{doi_number}}
• Conference Proceedings: {{proceedings_link}}
• Published On: {{publication_date}}
• Indexed by: {{indexing_bodies}}

The proceedings are now accessible on our website at {{website_link}}.

Authors: Please use this DOI when citing your presented work.

Thank you for your valuable contribution to the conference!

Best regards,
{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","doi_number","proceedings_link","publication_date","indexing_bodies","website_link","organizer_name","organization_name"],
    ["proceedings","DOI","publication","post-event"],
    "{{conference_name}} — Proceedings & DOI Published",
  ),

  tpl(
    "post-email-05",
    "Thank You & Next Event Announcement",
    "Marketing Team Coordination",
    "post",
    "email",
    `Dear {{participant_name}},

Thank you for being part of {{conference_name}} on {{date}}!

The conference was a tremendous success:
• {{participant_count}}+ participants from {{country_count}} countries
• {{session_count}} insightful sessions
• {{speaker_count}} distinguished speakers
• {{paper_count}} research papers presented

Event Highlights Video: {{highlights_link}}
Photo Gallery: {{gallery_link}}

Stay tuned for our next event — {{next_conference_name}} — coming {{next_conference_date}}!

Mark your calendar and register early: {{next_registration_link}}

With gratitude,
{{organizer_name}}
{{organization_name}}`,
    ["participant_name","conference_name","date","participant_count","country_count","session_count","speaker_count","paper_count","highlights_link","gallery_link","next_conference_name","next_conference_date","next_registration_link","organizer_name","organization_name"],
    ["thank you","next event","highlights","post-event"],
    "Thank You for Attending {{conference_name}} — See You Next Time!",
  ),

  // ─── POST-EVENT / WHATSAPP ────────────────────────────────────────────────
  tpl(
    "post-wa-01",
    "Certificate Sent",
    "Certificate Readiness",
    "post",
    "whatsapp",
    `Hi {{participant_name}} 🎓

Your *Certificate of {{certificate_type}}* for *{{conference_name}}* has been sent to your email!

📧 Check: {{email}}

For corrections, reply here within 7 days.

Thank you for attending! 🙏
_{{organization_name}}_`,
    ["participant_name","certificate_type","conference_name","email","organization_name"],
    ["certificate","post-event"],
  ),

  tpl(
    "post-wa-02",
    "Feedback Request",
    "Participants Feedback Collection",
    "post",
    "whatsapp",
    `Hi {{participant_name}} 👋

Thank you for attending *{{conference_name}}*! 🙏

We'd love your feedback — just 3 minutes! ⏱️

📝 Feedback form: {{feedback_form_link}}

Your input helps us improve future events! 😊
_{{organization_name}}_`,
    ["participant_name","conference_name","feedback_form_link","organization_name"],
    ["feedback","survey","post-event"],
  ),

  tpl(
    "post-wa-03",
    "Video Testimonial Request",
    "Video Bytes + Consent",
    "post",
    "whatsapp",
    `Hi {{presenter_name}} 👋

Your presentation at *{{conference_name}}* was fantastic! 🌟

Would you share a quick 30–60 sec video about your experience?

📹 Record and send here, or upload to:
{{file_share_link}}

Your testimonial will be featured in our highlights! 🎬
_{{organization_name}}_`,
    ["presenter_name","conference_name","file_share_link","organization_name"],
    ["video","testimonial","post-event"],
  ),

  tpl(
    "post-wa-04",
    "Highlights Reel Share",
    "Marketing Team Coordination",
    "post",
    "whatsapp",
    `🎬 *{{conference_name}}* Highlights are LIVE!

Watch the best moments from our conference:
📺 {{highlights_link}}

Thank you to all {{participant_count}}+ participants, speakers & organizers!

See you at the next event 🚀
_{{organization_name}}_`,
    ["conference_name","highlights_link","participant_count","organization_name"],
    ["highlights","reel","post-event"],
  ),

  tpl(
    "post-wa-05",
    "Proceedings Published",
    "Conference Report",
    "post",
    "whatsapp",
    `Hi {{participant_name}} 👋

Great news! *{{conference_name}}* proceedings are now published! 📄

🔗 DOI: {{doi_number}}
📚 Access here: {{proceedings_link}}

Cite your work using the DOI above.

Thank you for contributing! 🙏
_{{organization_name}}_`,
    ["participant_name","conference_name","doi_number","proceedings_link","organization_name"],
    ["proceedings","DOI","publication","post-event"],
  ),

  tpl(
    "post-wa-06",
    "Thank You & Next Event",
    "Marketing Team Coordination",
    "post",
    "whatsapp",
    `Hi {{participant_name}} 🙏

Thank you for being part of *{{conference_name}}*!

🎬 Highlights: {{highlights_link}}
📸 Photo Gallery: {{gallery_link}}

📢 Save the date for our next event:
*{{next_conference_name}}* — {{next_conference_date}}
🔗 Register early: {{next_registration_link}}

See you there! 🚀
_{{organization_name}}_`,
    ["participant_name","conference_name","highlights_link","gallery_link","next_conference_name","next_conference_date","next_registration_link","organization_name"],
    ["thank you","next event","post-event"],
  ),

  // ─── POST-EVENT / SOCIAL MEDIA ────────────────────────────────────────────
  tpl(
    "post-social-01",
    "Thank You Post",
    "Marketing Team Coordination",
    "post",
    "social",
    `🙏 A huge THANK YOU to everyone who made {{conference_name}} an unforgettable experience!

✅ {{participant_count}}+ participants
✅ {{speaker_count}} incredible speakers
✅ {{session_count}} powerful sessions
✅ {{country_count}} countries represented

It was an honour to host such a vibrant community of {{field}} professionals. 🌍

📸 Check out the highlights: {{highlights_link}}

Until next time! 💙

#ThankYou #{{conference_hashtag}} #{{hashtag1}}`,
    ["conference_name","participant_count","speaker_count","session_count","country_count","field","highlights_link","conference_hashtag","hashtag1"],
    ["thank you","post-event","wrap-up"],
  ),

  tpl(
    "post-social-02",
    "Highlights Reel Caption",
    "Marketing Team Coordination",
    "post",
    "social",
    `🎬 Relive the magic of {{conference_name}}!

From keynote addresses to breakthrough research presentations — every moment was inspiring. ✨

Watch our highlights reel: {{highlights_link}}

Tag someone who attended with you! 👇

#Highlights #{{conference_hashtag}} #{{hashtag1}}`,
    ["conference_name","highlights_link","conference_hashtag","hashtag1"],
    ["highlights","reel","post-event"],
  ),

  tpl(
    "post-social-03",
    "Certificate Achievement Post",
    "Certificate Readiness",
    "post",
    "social",
    `🎓 Certificates are OUT!

Congratulations to all {{participant_count}}+ participants of {{conference_name}} who have now received their certificates!

Check your email inbox 📧

Not received? Reply or DM us with your registration ID.

#Congratulations #Certificate #{{conference_hashtag}}`,
    ["participant_count","conference_name","conference_hashtag"],
    ["certificate","achievement","post-event"],
  ),

  tpl(
    "post-social-04",
    "Proceedings Published Post",
    "Conference Report",
    "post",
    "social",
    `📚 {{conference_name}} Proceedings are now PUBLISHED!

🔗 DOI: {{doi_number}}
📄 Access the full proceedings: {{proceedings_link}}

All presented research is now officially indexed and citable. Congratulations to all contributing authors! 🎉

#ResearchPublished #DOI #{{conference_hashtag}} #{{hashtag1}}`,
    ["conference_name","doi_number","proceedings_link","conference_hashtag","hashtag1"],
    ["proceedings","publication","research","post-event"],
  ),

  tpl(
    "post-social-05",
    "Feedback Appreciation Post",
    "Participants Feedback Collection",
    "post",
    "social",
    `💬 Your voices have been heard!

Thank you to everyone who took the time to share feedback on {{conference_name}}. 🙏

📊 Overall Satisfaction: {{satisfaction_score}}/5
💡 Top suggestion: {{top_suggestion}}

We're already working on making the next event even better! Stay tuned for {{next_conference_name}} 📢

#Feedback #Community #{{conference_hashtag}}`,
    ["conference_name","satisfaction_score","top_suggestion","next_conference_name","conference_hashtag"],
    ["feedback","community","post-event"],
  ),
];

export const PHASES: { value: Phase; label: string }[] = [
  { value: "pre", label: "Pre-Event" },
  { value: "during", label: "During Event" },
  { value: "post", label: "Post-Event" },
];

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "social", label: "Social Media" },
];
