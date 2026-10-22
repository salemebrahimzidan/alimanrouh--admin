export type CopyLang = 'ar' | 'en'
export type SiteSectionId = 'identity' | 'home' | 'pages'
export type FieldInput = 'text' | 'url' | 'email' | 'phone'

export type CopyField = {
  id: string
  label: string
  localized: boolean
  multiline?: boolean
  ltr?: boolean
  input: FieldInput
  ar: string
  en: string
}

export type CopyGroup = {
  title: string
  hint?: string
  fields: CopyField[]
}

export type SiteSection = {
  id: SiteSectionId
  title: string
  description: string
  groups: CopyGroup[]
}

export type SectionCopy = {
  ar: Record<string, string>
  en: Record<string, string>
}

type FieldOptions = {
  multiline?: boolean
  ltr?: boolean
  input?: FieldInput
  localized?: boolean
}

function field(ns: string, path: string, label: string, ar: string, en: string, options?: FieldOptions): CopyField {
  const localized = options?.localized ?? true
  return {
    id: `${ns}.${path}`,
    label,
    localized,
    multiline: options?.multiline,
    ltr: options?.ltr ?? options?.input !== undefined,
    input: options?.input ?? 'text',
    ar,
    en: localized ? en : ar,
  }
}

const text = field

export const siteSections: SiteSection[] = [
  {
    id: 'identity',
    title: 'الهوية والتواصل',
    description: 'الاسم وأرقام الهاتف والبريد والعناوين وروابط التواصل. تظهر في أعلى الموقع وتذييله وصفحة التواصل.',
    groups: [
      {
        title: 'اسم الوكالة',
        fields: [
          text('shared', 'brand.name', 'الاسم الكامل', 'وكالة الإيمان روح للسفر والسياحة', 'Al Iman Rouh Travel & Tourism'),
          text('shared', 'brand.nameShort', 'الاسم المختصر', 'الإيمان روح', 'Al Iman Rouh'),
          text('shared', 'brand.nameLatinUpper', 'الاسم اللاتيني', 'AL IMAN ROUH', 'AL IMAN ROUH', { localized: false, ltr: true }),
        ],
      },
      {
        title: 'بيانات التواصل',
        fields: [
          text('shared', 'company.phone', 'الهاتف الأول', '+966 50 707 5933', '', { localized: false, input: 'phone' }),
          text('shared', 'company.phone2', 'الهاتف الثاني', '+249 90 241 3559', '', { localized: false, input: 'phone' }),
          text('shared', 'company.email', 'البريد', 'info@alimanrouh.com', '', { localized: false, input: 'email' }),
          text('shared', 'company.hours', 'ساعات العمل', 'الأحد–الخميس، ٩:٠٠ ص – ١١:٠٠ م', 'Sun–Thu, 9:00 AM – 11:00 PM'),
          text('shared', 'company.address', 'العنوان', 'الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia'),
          text('shared', 'company.address2', 'العنوان الثاني', 'حي البوادي، جدة، المملكة العربية السعودية', 'Al Bawadi, Jeddah, Saudi Arabia'),
        ],
      },
      {
        title: 'روابط التواصل',
        hint: 'اترك الحقل فارغاً لإخفاء الأيقونة. الرابط يجب أن يبدأ بـ https://',
        fields: [
          text('shared', 'company.social.instagram', 'إنستغرام', '', '', { localized: false, input: 'url' }),
          text('shared', 'company.social.facebook', 'فيسبوك', '', '', { localized: false, input: 'url' }),
          text('shared', 'company.social.x', 'إكس', '', '', { localized: false, input: 'url' }),
          text('shared', 'company.social.tiktok', 'تيك توك', '', '', { localized: false, input: 'url' }),
          text('shared', 'company.social.snapchat', 'سناب شات', '', '', { localized: false, input: 'url' }),
          text('shared', 'company.social.youtube', 'يوتيوب', '', '', { localized: false, input: 'url' }),
        ],
      },
      {
        title: 'القائمة',
        fields: [
          text('shared', 'nav.home', 'الرئيسية', 'الرئيسية', 'Home'),
          text('shared', 'nav.umrah', 'العمرة', 'العمرة', 'Umrah'),
          text('shared', 'nav.hajj', 'الحج', 'الحج', 'Hajj'),
          text('shared', 'nav.tourism', 'الزيارات والتأشيرات', 'الزيارات والتأشيرات', 'Visits & Visas'),
          text('shared', 'nav.flights', 'تذاكر الطيران والباخرة', 'تذاكر الطيران والباخرة', 'Flight & Ferry Tickets'),
          text('shared', 'nav.hotels', 'الفنادق', 'الفنادق', 'Hotels'),
          text('shared', 'nav.offers', 'العروض', 'العروض', 'Offers'),
          text('shared', 'nav.about', 'عن الشركة', 'عن الشركة', 'About the company'),
          text('shared', 'nav.contact', 'تواصل معنا', 'تواصل معنا', 'Contact us'),
          text('shared', 'navbar.bookNow', 'زر احجز الآن', 'احجز الآن', 'Book now'),
        ],
      },
      {
        title: 'التذييل',
        fields: [
          text('shared', 'footer.headline', 'العبارة', 'سافر بثقة', 'Travel with confidence'),
          text('shared', 'footer.subheadline', 'الوصف', 'الحج والعمرة والطيران والفنادق والسياحة وعروض مختارة.', 'Hajj, Umrah, flights, hotels, tourism, and curated offers.', { multiline: true }),
          text('shared', 'footer.quickLinks', 'روابط سريعة', 'روابط سريعة', 'Quick links'),
          text('shared', 'footer.more', 'المزيد', 'المزيد', 'More'),
          text('shared', 'footer.contact', 'التواصل', 'التواصل', 'Contact'),
          text('shared', 'footer.follow', 'تابعنا', 'تابعنا', 'Follow us'),
          text('shared', 'footer.rights', 'الحقوق', 'جميع الحقوق محفوظة.', 'All rights reserved.'),
        ],
      },
    ],
  },
  {
    id: 'home',
    title: 'الصفحة الرئيسية',
    description: 'نصوص الغلاف والمزايا والأرقام وسبب الاختيار والوجهات في الصفحة الرئيسية.',
    groups: [
      {
        title: 'الغلاف',
        fields: [
          text('home', 'hero.eyebrow', 'السطر العلوي', 'الإيمان روح', 'Al Iman Rouh'),
          text('home', 'hero.titleLead', 'بداية العنوان', 'رحلتك الإيمانية', 'Your spiritual journey'),
          text('home', 'hero.titleAccent', 'تكملة العنوان', 'تبدأ من هنا', 'starts from here'),
          text('home', 'hero.subtitle', 'الوصف', 'حج وعمرة وسفر بمعايير راقية—أسعار شفافة، شركاء موثوقون على الأرض، ودعم بمستوى الكونسيرج لرحلة مطمئنة ومُرتّبة.', 'Premium Hajj, Umrah, and curated travel—crafted with transparent pricing, trusted partners on the ground, and concierge-level support for a calm, elevated pilgrimage experience.', { multiline: true }),
          text('home', 'hero.primaryCta', 'الزر الأول', 'احجز الآن', 'Book now'),
          text('home', 'hero.secondaryCta', 'الزر الثاني', 'تواصل معنا', 'Contact us'),
          text('home', 'whatsapp.label', 'زر واتساب', 'تواصل عبر واتساب', 'WhatsApp us'),
        ],
      },
      {
        title: 'المزايا',
        fields: [
          text('home', 'valueProps.items.0.title', 'الميزة ١ — العنوان', 'أسعار تنافسية', 'Competitive prices'),
          text('home', 'valueProps.items.0.subtitle', 'الميزة ١ — النص', 'باقات واضحة بقيمة حقيقية—من دون مفاجآت.', 'Transparent packages built around real value—not hidden fees.'),
          text('home', 'valueProps.items.1.title', 'الميزة ٢ — العنوان', 'خدمات متكاملة', 'Integrated services'),
          text('home', 'valueProps.items.1.subtitle', 'الميزة ٢ — النص', 'طيران وفنادق ونقل وإرشاد في مسار واحد منظم.', 'Flights, hotels, transport, and guidance orchestrated in one flow.'),
          text('home', 'valueProps.items.2.title', 'الميزة ٣ — العنوان', 'مرشدون متخصصون', 'Specialized guides'),
          text('home', 'valueProps.items.2.subtitle', 'الميزة ٣ — النص', 'فريق بخبرة يركز على الراحة والوضوح والاهتمام.', 'Experienced teams focused on comfort, clarity, and care.'),
          text('home', 'valueProps.items.3.title', 'الميزة ٤ — العنوان', 'دعم على مدار الساعة', '24/7 support'),
          text('home', 'valueProps.items.3.subtitle', 'الميزة ٤ — النص', 'معك قبل السفر وفي المشاعر وبعد عودتك.', 'Reachable before travel, in the Haram cities, and after you return.'),
        ],
      },
      {
        title: 'الأرقام',
        fields: [
          text('home', 'stats.eyebrow', 'السطر العلوي', 'أرقامنا', 'By the numbers'),
          text('home', 'stats.titleLead', 'بداية العنوان', 'ثقة الحجاج والمعتمرين', 'Trusted by pilgrims'),
          text('home', 'stats.titleAccent', 'تكملة العنوان', 'عاماً بعد عام', 'year after year'),
          text('home', 'stats.subtitle', 'الوصف', 'سنوات من الخبرة في تنظيم رحلات الحج والعمرة بعناية واهتمام بأدق التفاصيل.', 'Years of experience organising Hajj and Umrah journeys with care and attention to detail.', { multiline: true }),
          text('home', 'stats.cta', 'الزر', 'خطّط لرحلتك', 'Plan your journey'),
          text('home', 'stats.countries.value', 'الدول — الرقم', '+10', '+10', { localized: false, ltr: true }),
          text('home', 'stats.countries.label', 'الدول — التسمية', 'دولة نخدمها', 'Countries covered'),
          text('home', 'stats.countries.caption', 'الدول — الشرح', 'مسافرون ينضمون إلينا من مختلف الدول.', 'Travellers join us from across the region.'),
          text('home', 'stats.satisfaction.value', 'الرضا — الرقم', '98٪', '98%', { ltr: true }),
          text('home', 'stats.satisfaction.label', 'الرضا — التسمية', 'رضا العملاء', 'Customer satisfaction'),
          text('home', 'stats.satisfaction.caption', 'الرضا — الشرح', 'بناءً على آراء المسافرين معنا.', 'Based on feedback from our travellers.'),
          text('home', 'stats.experience.value', 'الخبرة — الرقم', '+15', '+15', { localized: false, ltr: true }),
          text('home', 'stats.experience.label', 'الخبرة — التسمية', 'سنة خبرة', 'Years of experience'),
          text('home', 'stats.experience.caption', 'الخبرة — الشرح', 'في تنظيم رحلات الحج والعمرة.', 'Organising Hajj and Umrah journeys.'),
          text('home', 'stats.pilgrims.value', 'الحجاج — الرقم', '+25,000', '+25,000', { localized: false, ltr: true }),
          text('home', 'stats.pilgrims.label', 'الحجاج — التسمية', 'حاجّ ومعتمر', 'Pilgrims served'),
          text('home', 'stats.pilgrims.caption', 'الحجاج — الشرح', 'وثقوا بنا في رحلتهم الإيمانية.', 'Who trusted us with their journey.'),
        ],
      },
      {
        title: 'لماذا الإيمان روح',
        fields: [
          text('home', 'whyUs.titleGold', 'العنوان الذهبي', 'لماذا الإيمان روح؟', 'Why choose Al Iman Rouh?'),
          text('home', 'whyUs.titleGreen', 'العنوان', 'نُفصّل كل خطوة في رحلتك.', 'We obsess over every detail of your journey.'),
          text('home', 'whyUs.intro', 'المقدمة', 'من قرب الفندق من الحرم وتوقيت النقل إلى الأوراق والمتابعة الميدانية—نصمّم المسار ليبقى تركيزك على العبادة براحة وثقة.', 'From hotel proximity and transport timing to paperwork and on-site assistance, we design each step so you can focus on worship—with confidence and peace of mind.', { multiline: true }),
          text('home', 'whyUs.items.0.title', 'البند ١ — العنوان', 'فنادق راقية', 'Premium hotels'),
          text('home', 'whyUs.items.0.subtitle', 'البند ١ — النص', 'إقامة مختارة بمعايير راحة قريبة من الحرم.', 'Carefully selected stays near the Haram with comfort-first standards.'),
          text('home', 'whyUs.items.1.title', 'البند ٢ — العنوان', 'برامج متنوعة', 'Diverse programs'),
          text('home', 'whyUs.items.1.subtitle', 'البند ٢ — النص', 'من الاقتصادي إلى المميز بمدد ومسارات وإضافات مرنة.', 'Economy to premium—flexible durations, routes, and add-ons.'),
          text('home', 'whyUs.items.2.title', 'البند ٣ — العنوان', 'نقل حديث', 'Modern transport'),
          text('home', 'whyUs.items.2.subtitle', 'البند ٣ — النص', 'مركبات مريحة وسائقون بخبرة ومواعيد منظّمة.', 'Punctual, comfortable vehicles and experienced drivers.'),
          text('home', 'whyUs.items.3.title', 'البند ٤ — العنوان', 'إجراءات سلسة', 'Easy procedures'),
          text('home', 'whyUs.items.3.subtitle', 'البند ٤ — النص', 'دعم وثائق واضح وإرشاد خطوة بخطوة.', 'Clear documentation support and step-by-step guidance.'),
        ],
      },
      {
        title: 'الوجهات',
        fields: [
          text('home', 'destinations.eyebrow', 'السطر العلوي', 'الوجهات', 'Destinations'),
          text('home', 'destinations.title', 'العنوان', 'أقرب إلى المشاعر', 'Closer to the sacred'),
          text('home', 'destinations.subtitle', 'الوصف', 'مسارات مدروسة داخل المملكة—ليبقى وقتك للعبادة بلا تعقيد.', 'Thoughtfully planned routes across the Kingdom—so your time in worship stays uninterrupted.'),
          text('home', 'destinations.cta', 'الزر', 'استكشف الوجهات', 'Explore destinations'),
          text('home', 'destinations.items.0.name', 'الوجهة ١', 'مكة المكرمة', 'Makkah'),
          text('home', 'destinations.items.0.desc', 'وصف الوجهة ١', 'إقامة تراعي القرب وتسهيل الوصول للحرم.', 'Proximity-led stays and smooth Haram access.'),
          text('home', 'destinations.items.1.name', 'الوجهة ٢', 'المدينة المنورة', 'Madinah'),
          text('home', 'destinations.items.1.desc', 'وصف الوجهة ٢', 'أجواء هادئة قرب المسجد النبوي الشريف.', 'Serene nights near Al-Masjid an-Nabawi.'),
          text('home', 'destinations.items.2.name', 'الوجهة ٣', 'جدة', 'Jeddah'),
          text('home', 'destinations.items.2.desc', 'وصف الوجهة ٣', 'وصول مريح عبر البوابة مع تنظيم النقل.', 'Gateway arrivals with streamlined transfers.'),
          text('home', 'destinations.items.3.name', 'الوجهة ٤', 'معالم إيمانية', 'Islamic sites'),
          text('home', 'destinations.items.3.desc', 'وصف الوجهة ٤', 'زيارات منظّمة مع مرشدين على دراية.', 'Curated ziyarat with knowledgeable guides.'),
        ],
      },
      {
        title: 'الدعوة للحجز',
        fields: [
          text('home', 'promo.title', 'عنوان التخطيط', 'خطّط مع فريق يفهم تفاصيل رحلات العبادة', 'Plan with advisors who understand pilgrimage travel'),
          text('home', 'promo.subtitle', 'نص التخطيط', 'أرسل التواريخ والمدينة والتفضيلات—نعود إليك بخيارات مناسبة خلال يوم عمل.', 'Tell us your dates, city, and preferences—we’ll return tailored options within one business day.', { multiline: true }),
          text('home', 'promo.primary', 'زر التخطيط', 'ابدأ التخطيط', 'Start planning'),
          text('home', 'promo.secondary', 'زر الاتصال', 'اتصل بنا', 'Call us now'),
          text('home', 'contactCta.title', 'عنوان الختام', 'جاهز للانطلاق؟', 'Ready to begin?'),
          text('home', 'contactCta.subtitle', 'نص الختام', 'شاركنا التفضيلات واحصل على مسارات مقترحة—من دون التزام.', 'Share your preferences and receive curated itineraries—no obligation.'),
          text('home', 'contactCta.action', 'زر الختام', 'تواصل معنا', 'Contact us'),
        ],
      },
    ],
  },
  {
    id: 'pages',
    title: 'صفحات الموقع',
    description: 'عناوين صفحات عن الشركة والتواصل والعروض والعمرة والحج والطيران والتأشيرات والفنادق. البرامج والأسعار تبقى في صفحات العمرة والحج.',
    groups: [
      {
        title: 'عن الشركة',
        fields: [
          text('about', 'title', 'العنوان', 'عن الشركة', 'About the company'),
          text('about', 'body', 'النص', 'وكالة الإيمان روح للسفر والسياحة تخطّط لرحلات الحج والعمرة والبرامج المختارة بأسعار واضحة وشركاء موثوقين ودعمٍ يهتم بتفاصيل رحلتك. ستُوسَّم هذه الصفحة لاحقًا بقصة الشركة والتراخيص والفريق.', 'Al Iman Rouh Travel & Tourism plans Hajj, Umrah, and curated journeys with clear pricing, trusted partners, and attentive support. This page will be expanded with your company story, licenses, and team.', { multiline: true }),
        ],
      },
      {
        title: 'تواصل معنا',
        fields: [
          text('contact', 'title', 'العنوان', 'تواصل معنا', 'Contact'),
          text('contact', 'subtitle', 'الوصف', 'أخبرنا بما تحتاجه وسنرد عليك.', 'Tell us what you need and we’ll respond.'),
          text('contact', 'map.title', 'عنوان الخريطة', 'موقعنا', 'Find us'),
          text('contact', 'map.subtitle', 'وصف الخريطة', 'تفضّل بزيارة مكتبنا أو احصل على الاتجاهات خطوة بخطوة عبر خرائط Google.', 'Visit our office or get turn-by-turn directions in Google Maps.', { multiline: true }),
        ],
      },
      {
        title: 'العروض',
        fields: [
          text('offers', 'title', 'العنوان', 'العروض', 'Offers'),
          text('offers', 'subtitle', 'الوصف', 'عروض موسمية وصفقات مختارة.', 'Seasonal specials and curated deals.'),
          text('offers', 'seasonal.title', 'عنوان القسم', 'عروض موسمية', 'Seasonal offers'),
          text('offers', 'seasonal.subtitle', 'وصف القسم', 'باقات لفترة محدودة.', 'Limited-time packages.'),
          text('offers', 'empty', 'عند عدم وجود عروض', 'لا توجد عروض منشورة حالياً.', 'No published offers yet.'),
        ],
      },
      {
        title: 'العمرة',
        fields: [
          text('umrah', 'hero.eyebrow', 'السطر العلوي', 'برامج العمرة', 'Umrah programs'),
          text('umrah', 'hero.title', 'العنوان', 'أدِّ عمرتك بطمأنينة وراحة بال', 'Perform Umrah with peace of mind'),
          text('umrah', 'hero.subtitle', 'الوصف', 'تأشيرة وطيران وفنادق قريبة من الحرم ونقل وإرشاد — نرتّب كل التفاصيل لتتفرغ للعبادة.', 'Visa, flights, hotels near the Haram, transport and guidance — we arrange every detail so you can focus on worship.', { multiline: true }),
          text('umrah', 'hero.primaryCta', 'الزر', 'احجز عمرتك', 'Book your Umrah'),
          text('umrah', 'hero.whatsappCta', 'واتساب', 'اسألنا عبر واتساب', 'Ask on WhatsApp'),
        ],
      },
      {
        title: 'الحج',
        fields: [
          text('hajj', 'hero.eyebrow', 'السطر العلوي', 'برامج الحج', 'Hajj programs'),
          text('hajj', 'hero.title', 'العنوان', 'لبِّ نداء الحج بثقة وطمأنينة', 'Answer the call of Hajj with confidence'),
          text('hajj', 'hero.subtitle', 'الوصف', 'رحلة حج منظمة بعناية — من الإجراءات حتى منى وعرفات ومزدلفة — مع فريق متمرس بجانبك في كل خطوة.', 'A carefully organised Hajj journey — from paperwork to Mina, Arafat and Muzdalifah — with an experienced team beside you at every step.', { multiline: true }),
          text('hajj', 'hero.primaryCta', 'الزر', 'احجز حجك', 'Book your Hajj'),
          text('hajj', 'hero.whatsappCta', 'واتساب', 'اسألنا عبر واتساب', 'Ask on WhatsApp'),
        ],
      },
      {
        title: 'الطيران والباخرة',
        fields: [
          text('flights', 'hero.eyebrow', 'السطر العلوي', 'حجوزات السفر', 'Travel bookings'),
          text('flights', 'hero.title', 'العنوان', 'تذاكر الطيران والباخرة', 'Flight and ferry tickets'),
          text('flights', 'hero.subtitle', 'الوصف', 'نحجز لك تذاكر الطيران على مختلف الخطوط وتذاكر الباخرة عبر البحر الأحمر بأفضل الأسعار المتاحة، مع متابعة كاملة من الحجز حتى السفر.', 'We book flight tickets across airlines and passenger ferry tickets on the Red Sea at the best available prices, with full support from booking to departure.', { multiline: true }),
          text('flights', 'hero.primaryCta', 'الزر', 'احجز تذكرتك', 'Book your ticket'),
          text('flights', 'hero.whatsappCta', 'واتساب', 'اسأل عن الأسعار', 'Ask for prices'),
        ],
      },
      {
        title: 'الزيارات والتأشيرات',
        fields: [
          text('tourism', 'hero.eyebrow', 'السطر العلوي', 'الزيارات والتأشيرات', 'Visits & visas'),
          text('tourism', 'hero.title', 'العنوان', 'الزيارات العائلية والتأشيرات السياحية', 'Family visit and tourist visas'),
          text('tourism', 'hero.subtitle', 'الوصف', 'نتولّى عنك إجراءات تأشيرة الزيارة العائلية والتأشيرة السياحية للمملكة—من تجهيز المستندات حتى استلام التأشيرة، بسرعة ووضوح ومتابعة مستمرة.', 'We handle Saudi family visit and tourist visa procedures for you—from preparing documents to receiving the visa, quickly, clearly, and with constant follow-up.', { multiline: true }),
          text('tourism', 'hero.primaryCta', 'الزر', 'قدّم طلبك الآن', 'Apply now'),
          text('tourism', 'hero.whatsappCta', 'واتساب', 'استشارة عبر واتساب', 'Ask on WhatsApp'),
        ],
      },
      {
        title: 'الفنادق',
        fields: [
          text('hotels', 'title', 'العنوان', 'الفنادق', 'Hotels'),
          text('hotels', 'subtitle', 'الوصف', 'تصفح إقامات براحة راقية.', 'Browse stays with premium comfort.'),
        ],
      },
    ],
  },
]

const sectionsById = new Map(siteSections.map((section) => [section.id, section]))

export function sectionFields(sectionId: SiteSectionId) {
  const section = sectionsById.get(sectionId)
  if (!section) return []
  return section.groups.flatMap((group) => group.fields)
}

export function defaultCopy(sectionId: SiteSectionId): SectionCopy {
  const ar: Record<string, string> = {}
  const en: Record<string, string> = {}
  for (const field of sectionFields(sectionId)) {
    ar[field.id] = field.ar
    en[field.id] = field.en
  }
  return { ar, en }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function stringMap(value: unknown) {
  const map: Record<string, string> = {}
  for (const [key, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string') map[key] = item
  }
  return map
}

export function readCopy(sectionId: SiteSectionId, raw: unknown): SectionCopy {
  const base = defaultCopy(sectionId)
  const content = asRecord(raw)
  const savedAr = stringMap(content.ar)
  const savedEn = stringMap(content.en)
  for (const field of sectionFields(sectionId)) {
    if (typeof savedAr[field.id] === 'string') base.ar[field.id] = savedAr[field.id]
    if (field.localized && typeof savedEn[field.id] === 'string') base.en[field.id] = savedEn[field.id]
    if (!field.localized) base.en[field.id] = base.ar[field.id]
  }
  return base
}

function limit(field: CopyField) {
  return field.multiline ? 2000 : 300
}

export function validateCopy(sectionId: SiteSectionId, copy: SectionCopy) {
  for (const field of sectionFields(sectionId)) {
    const values = field.localized ? [copy.ar[field.id] ?? '', copy.en[field.id] ?? ''] : [copy.ar[field.id] ?? '']
    for (const value of values) {
      const text = value.trim()
      if (text.length > limit(field)) return `${field.label}: النص أطول من الحد المسموح.`
      if (!text) continue
      if (field.input === 'url' && !/^https:\/\/\S+$/.test(text)) return `${field.label}: الرابط يجب أن يبدأ بـ https://`
      if (field.input === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `${field.label}: أدخل بريداً صالحاً.`
      if (field.input === 'phone' && !/^\+?[0-9][0-9\s()-]{5,24}$/.test(text)) return `${field.label}: أدخل رقماً صالحاً.`
    }
  }
  return null
}

export function normalizeCopy(sectionId: SiteSectionId, copy: SectionCopy): SectionCopy {
  const ar: Record<string, string> = {}
  const en: Record<string, string> = {}
  for (const field of sectionFields(sectionId)) {
    const arabic = (copy.ar[field.id] ?? '').trim()
    const english = (copy.en[field.id] ?? '').trim()
    ar[field.id] = arabic
    en[field.id] = field.localized ? english : arabic
  }
  return { ar, en }
}

export type CopyBundles = Record<CopyLang, Record<string, Record<string, unknown>>>

function setPath(root: Record<string, unknown>, path: string, value: string) {
  const parts = path.split('.')
  let node = root
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    const next = node[part]
    if (!next || typeof next !== 'object' || Array.isArray(next)) node[part] = {}
    node = node[part] as Record<string, unknown>
  }
  node[parts[parts.length - 1]] = value
}

export function bundlesFromCopy(copies: SectionCopy[]): CopyBundles {
  const bundles: CopyBundles = { ar: {}, en: {} }
  for (const copy of copies) {
    for (const lang of ['ar', 'en'] as const) {
      for (const [key, value] of Object.entries(copy[lang])) {
        const text = value.trim()
        const dot = key.indexOf('.')
        if (!text || dot <= 0) continue
        const ns = key.slice(0, dot)
        const path = key.slice(dot + 1)
        if (!/^[a-z]+$/.test(ns) || !/^[A-Za-z0-9.]+$/.test(path)) continue
        const tree = bundles[lang][ns] ?? {}
        bundles[lang][ns] = tree
        setPath(tree, path, text)
      }
    }
  }
  return bundles
}
