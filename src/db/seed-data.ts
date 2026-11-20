import type { Category } from "@/lib/domain";

// Approximate centres of real Peshawar localities. "Cantt" and "Peshawar
// Cantonment" are the same place, so they are one area with both names as aliases.
export const SEED_AREAS: {
  nameEn: string;
  nameUr: string;
  lat: number;
  lng: number;
  aliases: string[];
}[] = [
  { nameEn: "Hayatabad Phase 1", nameUr: "حیات آباد فیز ۱", lat: 33.9985, lng: 71.4565, aliases: ["حیات آباد فیز 1", "حیات آباد فیز ایک", "hayatabad phase one", "phase 1"] },
  { nameEn: "Hayatabad Phase 2", nameUr: "حیات آباد فیز ۲", lat: 33.9905, lng: 71.4495, aliases: ["حیات آباد فیز 2", "حیات آباد فیز دو", "hayatabad phase two", "phase 2"] },
  { nameEn: "Hayatabad Phase 3", nameUr: "حیات آباد فیز ۳", lat: 33.9835, lng: 71.4395, aliases: ["حیات آباد فیز 3", "حیات آباد فیز تین", "hayatabad phase three", "phase 3"] },
  { nameEn: "Hayatabad Phase 4", nameUr: "حیات آباد فیز ۴", lat: 33.9765, lng: 71.4505, aliases: ["حیات آباد فیز 4", "حیات آباد فیز چار", "hayatabad phase four", "phase 4"] },
  { nameEn: "Hayatabad Phase 5", nameUr: "حیات آباد فیز ۵", lat: 33.9695, lng: 71.4395, aliases: ["حیات آباد فیز 5", "حیات آباد فیز پانچ", "hayatabad phase five", "phase 5"] },
  { nameEn: "Hayatabad Phase 6", nameUr: "حیات آباد فیز ۶", lat: 33.9635, lng: 71.4285, aliases: ["حیات آباد فیز 6", "حیات آباد فیز چھ", "hayatabad phase six", "phase 6"] },
  { nameEn: "Hayatabad Phase 7", nameUr: "حیات آباد فیز ۷", lat: 33.9555, lng: 71.4195, aliases: ["حیات آباد فیز 7", "حیات آباد فیز سات", "hayatabad phase seven", "phase 7"] },
  { nameEn: "University Town", nameUr: "یونیورسٹی ٹاؤن", lat: 34.0015, lng: 71.4985, aliases: ["یونیورسٹی ٹاون", "town", "university road"] },
  { nameEn: "Saddar", nameUr: "صدر", lat: 34.0036, lng: 71.5449, aliases: ["صدر بازار", "saddar bazaar", "sadar"] },
  { nameEn: "Cantt", nameUr: "کینٹ", lat: 34.0085, lng: 71.5375, aliases: ["peshawar cantonment", "cantonment", "پشاور کینٹ", "کنٹونمنٹ", "چھاؤنی", "peshawar cantt"] },
  { nameEn: "Gulbahar", nameUr: "گلبہار", lat: 34.0105, lng: 71.589, aliases: ["گل بہار", "gul bahar", "gulbahar colony"] },
  { nameEn: "Board Bazaar", nameUr: "بورڈ بازار", lat: 33.9995, lng: 71.4795, aliases: ["board", "بورڈ", "board bazar"] },
  { nameEn: "Tehkal", nameUr: "تہکال", lat: 34.0045, lng: 71.5135, aliases: ["tehkal payan", "tehkal bala", "تہکال پایاں", "تہکال بالا", "tahkal"] },
  { nameEn: "Faqirabad", nameUr: "فقیر آباد", lat: 34.02, lng: 71.58, aliases: ["فقیرآباد", "faqeerabad", "faqir abad"] },
  { nameEn: "Ring Road", nameUr: "رنگ روڈ", lat: 33.981, lng: 71.531, aliases: ["رنگ روڈ پشاور", "ringroad"] },
  { nameEn: "Warsak Road", nameUr: "ورسک روڈ", lat: 34.049, lng: 71.521, aliases: ["warsak", "ورسک"] },
  { nameEn: "Kohat Road", nameUr: "کوہاٹ روڈ", lat: 33.981, lng: 71.561, aliases: ["kohat", "کوہاٹ"] },
  { nameEn: "Dalazak Road", nameUr: "دلہ زاک روڈ", lat: 34.0255, lng: 71.6045, aliases: ["dalazak", "دلازاک روڈ", "دلہ زاک", "دلازاک"] },
  { nameEn: "Charsadda Road", nameUr: "چارسدہ روڈ", lat: 34.0445, lng: 71.585, aliases: ["charsadda", "چارسدہ"] },
  { nameEn: "Nothia", nameUr: "نوتھیہ", lat: 34.0005, lng: 71.556, aliases: ["nauthia", "نوتھیہ قدیم", "نوتھیہ جدید", "nothia qadeem"] },
  { nameEn: "Yakatoot", nameUr: "یکہ توت", lat: 34.0035, lng: 71.5805, aliases: ["yakka toot", "yaka toot", "یکہ توت"] },
  { nameEn: "Hashtnagri", nameUr: "ہشتنگری", lat: 34.014, lng: 71.583, aliases: ["hashtnagri", "hasht nagri", "ہشت نگری"] },
  { nameEn: "Gulberg", nameUr: "گلبرگ", lat: 33.993, lng: 71.548, aliases: ["gulberg", "گل برگ"] },
  { nameEn: "Mathra", nameUr: "متھرا", lat: 34.0905, lng: 71.4905, aliases: ["mathra", "متھرہ"] },
];

export const SEED_DEPARTMENTS: {
  code: string;
  name: string;
  nameUr: string;
  categories: Category[];
  slaHours: number;
  slaByCategory: Partial<Record<Category, number>>;
}[] = [
  {
    code: "WSSP",
    name: "Water & Sanitation Services Peshawar",
    nameUr: "واٹر اینڈ سینی ٹیشن سروسز پشاور",
    categories: ["water", "sewerage", "garbage"],
    slaHours: 24,
    slaByCategory: { water: 24, sewerage: 24, garbage: 12 },
  },
  {
    code: "TMA",
    name: "Tehsil Municipal Administration",
    nameUr: "تحصیل میونسپل ایڈمنسٹریشن",
    categories: ["streetlight", "road"],
    slaHours: 48,
    slaByCategory: { streetlight: 48, road: 72 },
  },
  {
    code: "PESCO",
    name: "Peshawar Electric Supply Company",
    nameUr: "پشاور الیکٹرک سپلائی کمپنی",
    categories: ["electricity"],
    slaHours: 6,
    slaByCategory: { electricity: 6 },
  },
];

type SeedStatus = "open" | "assigned" | "in_progress" | "resolved";

/** minutesAgo is measured back from the moment of seeding. */
export const SEED_TICKETS: {
  area: string;
  category: Category;
  status: SeedStatus;
  minutesAgo: number;
  name: string;
  phone: string;
  ur: string;
  en: string;
  mood: number;
  note?: string;
}[] = [
  // Two open "no water" reports in Gulbahar: the third, made live on stage, raises an incident.
  // They are seeded minutes old so the 2-hour clustering window stays open for ~1h45m after a reset.
  { area: "Gulbahar", category: "water", status: "open", minutesAgo: 14, name: "Gul Zaman", phone: "03335550148", mood: 2, ur: "گلبہار گلی نمبر ۴ میں صبح سے پانی نہیں آ رہا۔", en: "No water supply in Gulbahar Street 4 since morning." },
  { area: "Gulbahar", category: "water", status: "assigned", minutesAgo: 5, name: "Rukhsana Begum", phone: "03005550122", mood: 3, ur: "گلبہار نمبر ۲ میں پانی کی سپلائی بند ہے، ٹیوب ویل خراب لگتا ہے۔", en: "Water supply is off in Gulbahar No. 2; the tube well seems to be faulty." },

  { area: "Hashtnagri", category: "electricity", status: "open", minutesAgo: 35, name: "Bilal Khattak", phone: "03455550135", mood: 1, ur: "ہشتنگری میں بجلی کا تار ٹوٹ کر گلی میں گرا ہوا ہے، بچے قریب کھیل رہے ہیں۔", en: "A live electricity wire has snapped and fallen in the street in Hashtnagri; children are playing nearby." },
  { area: "Tehkal", category: "streetlight", status: "open", minutesAgo: 28, name: "Hina Qureshi", phone: "03125550128", mood: 4, ur: "تہکال پایاں کی مرکزی گلی میں سٹریٹ لائٹس بند ہیں۔", en: "Streetlights are off on the main street of Tehkal Payan." },
  { area: "University Town", category: "garbage", status: "open", minutesAgo: 40, name: "Asad Mehmood", phone: "03215550140", mood: 3, ur: "یونیورسٹی ٹاؤن پارک روڈ پر کچرے کے ڈبے دو دن سے خالی نہیں ہوئے۔", en: "Garbage bins on Park Road, University Town have not been emptied for two days." },
  { area: "Board Bazaar", category: "sewerage", status: "open", minutesAgo: 65, name: "Imran Yousafzai", phone: "03465550165", mood: 2, ur: "بورڈ بازار کی مین سڑک پر گٹر ابل رہا ہے، گندا پانی دکانوں میں جا رہا ہے۔", en: "A sewer is overflowing on the main road at Board Bazaar and dirty water is entering the shops." },
  { area: "Warsak Road", category: "garbage", status: "open", minutesAgo: 75, name: "Sana Afridi", phone: "03335550175", mood: 3, ur: "ورسک روڈ پر سکول کے سامنے کچرے کا ڈھیر لگا ہوا ہے۔", en: "A pile of garbage has built up in front of the school on Warsak Road." },
  { area: "Hayatabad Phase 5", category: "water", status: "open", minutesAgo: 90, name: "Farhan Orakzai", phone: "03005550190", mood: 3, ur: "حیات آباد فیز ۵ سیکٹر ایف-۹ میں پانی کا پریشر بہت کم ہے۔", en: "Water pressure is very low in Sector F-9, Hayatabad Phase 5." },
  { area: "Hayatabad Phase 3", category: "streetlight", status: "open", minutesAgo: 95, name: "Mehwish Khan", phone: "03155550195", mood: 3, ur: "حیات آباد فیز ۳ کے سیکٹر کے-۲ میں سٹریٹ لائٹس تین دن سے بند ہیں۔", en: "Streetlights in Sector K-2, Hayatabad Phase 3 have been off for three days." },
  { area: "Mathra", category: "water", status: "open", minutesAgo: 110, name: "Rashid Wazir", phone: "03459550110", mood: 2, ur: "متھرا میں ٹیوب ویل کی موٹر جل گئی ہے، پورے محلے میں پانی نہیں۔", en: "The tube-well motor has burnt out in Mathra; the whole neighbourhood is without water." },
  { area: "Ring Road", category: "streetlight", status: "open", minutesAgo: 180, name: "Kamran Bangash", phone: "03335550180", mood: 4, ur: "رنگ روڈ پر حیات آباد موڑ کے پاس لائٹیں بند ہیں، رات کو اندھیرا رہتا ہے۔", en: "Lights are off on Ring Road near the Hayatabad turn; it is dark at night." },
  { area: "Charsadda Road", category: "road", status: "open", minutesAgo: 260, name: "Javed Iqbal", phone: "03005550260", mood: 3, ur: "چارسدہ روڈ پر بخشی پل کے قریب سڑک ٹوٹی ہوئی ہے۔", en: "The road is broken near Bakhshi Pul on Charsadda Road." },

  { area: "Hayatabad Phase 2", category: "garbage", status: "assigned", minutesAgo: 120, name: "Saima Gul", phone: "03125550120", mood: 3, ur: "حیات آباد فیز ۲ کے سیکٹر جے-۱ میں کچرا اٹھانے والی گاڑی نہیں آئی۔", en: "The garbage truck has not come to Sector J-1, Hayatabad Phase 2." },
  { area: "Hayatabad Phase 7", category: "streetlight", status: "assigned", minutesAgo: 150, name: "Adnan Shinwari", phone: "03465550150", mood: 4, ur: "حیات آباد فیز ۷ کی مین روڈ پر کئی سٹریٹ لائٹس خراب ہیں۔", en: "Several streetlights are faulty on the main road of Hayatabad Phase 7." },
  { area: "Dalazak Road", category: "sewerage", status: "assigned", minutesAgo: 160, name: "Nadia Rehman", phone: "03215550160", mood: 2, ur: "دلہ زاک روڈ پر نالہ بند ہے، گلی میں گندا پانی کھڑا ہے۔", en: "The drain is blocked on Dalazak Road and sewage is standing in the street." },
  { area: "Tehkal", category: "road", status: "assigned", minutesAgo: 210, name: "Usman Mohmand", phone: "03335550210", mood: 3, ur: "تہکال بالا کی سڑک پر بڑا گڑھا ہے، حادثے کا خطرہ ہے۔", en: "There is a large pothole on the Tehkal Bala road; it is an accident risk." },
  { area: "Dalazak Road", category: "electricity", status: "assigned", minutesAgo: 400, name: "Tariq Durrani", phone: "03005550400", mood: 2, ur: "دلہ زاک روڈ پر ٹرانسفارمر خراب ہے، صبح سے بجلی نہیں۔", en: "The transformer on Dalazak Road has failed; no electricity since morning." },

  { area: "Kohat Road", category: "electricity", status: "in_progress", minutesAgo: 310, name: "Waqar Ahmed", phone: "03455550310", mood: 2, ur: "کوہاٹ روڈ پر پانچ گھنٹے سے بجلی بند ہے۔", en: "Electricity has been off for five hours on Kohat Road." },
  { area: "Faqirabad", category: "sewerage", status: "in_progress", minutesAgo: 100, name: "Shazia Malik", phone: "03125550100", mood: 3, ur: "فقیر آباد نمبر ۲ میں مین ہول کا ڈھکن غائب ہے۔", en: "A manhole cover is missing in Faqirabad No. 2." },
  { area: "Saddar", category: "garbage", status: "in_progress", minutesAgo: 130, name: "Ahmad Khan", phone: "03335550130", mood: 3, ur: "صدر بازار کے قریب کچرے کا ڈھیر لگا ہے، بدبو پھیل رہی ہے۔", en: "A heap of garbage near Saddar Bazaar is spreading a foul smell." },
  { area: "Nothia", category: "water", status: "in_progress", minutesAgo: 140, name: "Fatima Bibi", phone: "03005550141", mood: 2, ur: "نوتھیہ قدیم میں نلکوں سے گندا پانی آ رہا ہے۔", en: "Dirty water is coming from the taps in Nothia Qadeem." },
  { area: "Hayatabad Phase 6", category: "road", status: "in_progress", minutesAgo: 230, name: "Haroon Rashid", phone: "03465550230", mood: 4, ur: "حیات آباد فیز ۶ میں سڑک کی کھدائی کے بعد مرمت نہیں ہوئی۔", en: "The road in Hayatabad Phase 6 was dug up and never repaired." },

  { area: "Saddar", category: "electricity", status: "resolved", minutesAgo: 200, name: "Zainab Shah", phone: "03215550200", mood: 3, ur: "صدر میں فوارہ چوک کے قریب بجلی کا کھمبا جھکا ہوا ہے۔", en: "An electricity pole is leaning dangerously near Fawara Chowk, Saddar.", note: "Pole secured and supply restored." },
  { area: "Hayatabad Phase 4", category: "electricity", status: "resolved", minutesAgo: 280, name: "Noor Jehan", phone: "03335550280", mood: 2, ur: "حیات آباد فیز ۴ میں بجلی کی وولٹیج بہت کم آ رہی ہے۔", en: "Voltage is very low in Hayatabad Phase 4.", note: "Transformer tap adjusted; voltage normal." },
  { area: "University Town", category: "electricity", status: "resolved", minutesAgo: 300, name: "Ayesha Siddiqui", phone: "03005550300", mood: 1, ur: "یونیورسٹی ٹاؤن میں ٹرانسفارمر سے چنگاریاں نکل رہی ہیں۔", en: "Sparks are coming from the transformer in University Town.", note: "Faulty jumper replaced." },
  { area: "Hayatabad Phase 1", category: "sewerage", status: "resolved", minutesAgo: 340, name: "Lubna Yousaf", phone: "03125550340", mood: 3, ur: "حیات آباد فیز ۱ کے سیکٹر ڈی-۲ میں سیوریج لائن بند ہے۔", en: "The sewerage line is blocked in Sector D-2, Hayatabad Phase 1.", note: "Line cleared with jetting machine." },
  { area: "Charsadda Road", category: "water", status: "resolved", minutesAgo: 360, name: "Naveed Anjum", phone: "03455550360", mood: 3, ur: "چارسدہ روڈ پر پانی کی پائپ لائن لیک ہو رہی ہے۔", en: "A water pipeline is leaking on Charsadda Road.", note: "Leak clamped and road patched." },
  { area: "Yakatoot", category: "garbage", status: "resolved", minutesAgo: 380, name: "Samina Akhtar", phone: "03335550380", mood: 3, ur: "یکہ توت میں گلی کے کونے پر کچرا جمع ہے۔", en: "Garbage has collected at the street corner in Yakatoot.", note: "Collection point cleared." },
  { area: "Faqirabad", category: "water", status: "resolved", minutesAgo: 420, name: "Kiran Shah", phone: "03005550420", mood: 2, ur: "فقیر آباد میں پائپ لائن پھٹ گئی ہے، پانی ضائع ہو رہا ہے۔", en: "A pipeline has burst in Faqirabad and water is being wasted.", note: "Burst section replaced." },
  { area: "Gulberg", category: "streetlight", status: "resolved", minutesAgo: 460, name: "Maryam Noor", phone: "03215550460", mood: 4, ur: "گلبرگ نمبر ۱ میں سٹریٹ لائٹ دن میں بھی جلتی رہتی ہے۔", en: "A streetlight in Gulberg No. 1 stays on during the day.", note: "Timer switch replaced." },
  { area: "Cantt", category: "road", status: "resolved", minutesAgo: 500, name: "Tahir Afridi", phone: "03465550500", mood: 4, ur: "کینٹ میں مال روڈ کے قریب سپیڈ بریکر ٹوٹا ہوا ہے۔", en: "A speed breaker is broken near Mall Road in Cantt.", note: "Speed breaker rebuilt." },
];

export const OFFICER_NAMES: Record<string, string[]> = {
  WSSP: ["Insp. Shahid Afridi (WSSP)", "Engr. Sadia Khan (WSSP)"],
  TMA: ["Sub-Engr. Fazal Rahim (TMA)", "Supervisor Noman Ali (TMA)"],
  PESCO: ["SDO Irfan Ullah (PESCO)", "Lineman Supervisor Aziz Khan (PESCO)"],
};
