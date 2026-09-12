import { StudentSessionPerformance } from '../types';

export const arabicBaseMale = {
  excellent: [
    'ما شاء الله مستواه هايل وفاهم الدرس ومستوعب كويس جداً',
    'أداء فوق الممتاز وتطبيق عملي ممتاز لكل اللي اتشرح النهاردة',
    'كان شاطر جداً ومنور الحصة ومركز في كل تفصيلة',
    'استيعابه سريع ومستواه يبسط ما شاء الله ومشارك بإيجابية',
    'أداء ممتاز وماشي بخطوات ثابتة وواثقة في الألماني',
    'من أشطر الطلاب النهارده، استيعاب سريع وتطبيق دقيق',
    'حصة ممتازة جداً وأداؤه فيها يشرف ويبسط',
    'مستواه يفتح النفس ما شاء الله، لقط الدرس وطبقه فوراً',
    'أداء رائع ومبهر طول الحصة في كل الأنشطة',
    'ما شاء الله قمة في الشطارة والتركيز في سيشن النهارده',
    'أبدع في حصة النهارده واستوعب كل القواعد الجديدة بسهولة',
    'ما شاء الله عليه، كان متألق ومستوعب الشرح من أول دقيقة',
    'أداء ممتاز جداً واستجابة سريعة لكل أسئلة وتدريبات الدرس',
    'طالب متميز جداً ومستواه بيكبر ويثبت كل حصة عن اللي قبلها',
    'شغل عالي جداً واستيعاب وفهم ممتاز للغة الألمانية'
  ],
  very_good: [
    'شغال كويس جداً ومستجيب بشكل ممتاز مع الشرح والتدريبات',
    'ما شاء الله ماشي بخطوات ممتازة وفاهم اللي بناخده',
    'مستوى محترم ومتابع معانا أول بأول بإتقان',
    'أداؤه مريح ومستوعب النقاط الجديدة في الدرس كويس',
    'كان شاطر ومستواه طيب جداً طوال وقت السيشن',
    'أداء جيد جداً ومجهوده واضح ومثمر في الحصة',
    'ماشي برتم ممتاز ومستوعب أغلب أفكار الدرس باقتدار',
    'استيعابه للدرس كان عالي ومطبق على التمارين بنجاح',
    'مستوى ممتاز وقريب جداً من الدرجة الكاملة في الفهم والتطبيق',
    'شاطر ومتابع الشرح بانتظام وبيحل معانا كويس جداً',
    'أداء يفرح ومجهود تشكر عليه في استيعاب المادة',
    'ما شاء الله مستواه ثابت وبيتقدم بخطوات ممتازة'
  ],
  good: [
    'مستواه كويس ومتابع معانا في الحصة',
    'ماشي تمام ومستوعب النقاط الأساسية في الدرس',
    'أداء طيب ومتفاعل في معظم أجزاء السيشن',
    'فاهم الشرح ومحتاج يستمر على نفس المستوى ويكثف التدريب',
    'أداؤه كويس ومشارك معانا في التدريبات',
    'استيعابه لا بأس به وفاهم الفكرة العامة للدرس',
    'مستوى مرضي وماشي بخطى مقبولة في المنهج',
    'متابع الشرح كويس وعمل شغل طيب في الحصة',
    'فاهم المطلوب وبيحاول يطبق معانا خطوة بخطوة',
    'مستوى جيد ومحتاج تثبيت بالحل والمذاكرة في البيت'
  ],
  developing: [
    'بيتحسن خطوة بخطوة ومحتاج بس شوية تدريب وحل زيادة',
    'بدأ يستوعب المادة بشكل أحسن ومحتاجين نثبت المعلومات بالمراجعة',
    'مستواه بيتقدم ومحتاج شوية استمرارية في الحل والمذاكرة أول بأول',
    'بداية كويسة في استيعاب الدرس ومحتاج يحل تدريبات أكتر في البيت',
    'استيعابه بيتحسن بس محتاجين نراجع الكلمات والقواعد سوا',
    'بيحاول ومستواه في تقدم ومحتاج شوية تركيز إضافي على النقط الصعبة',
    'محتاج بس ممارسة أكتر عشان المعلومة تثبت في دماغه وميترددش',
    'في بوادر فهم كويسة ومحتاجين ندعمه بحل شيتات زيادة',
    'ماشي في طريق التحسن ومحتاج يكرر الكلمات الجديدة أكتر'
  ],
  needs_support: [
    'محتاج يشد حيله شوية في المذاكرة وحل التدريبات أول بأول',
    'محتاجين نركز أكتر الفترة الجاية على مراجعة الكلمات والقواعد وتثبيتها',
    'سيستفيد جداً من مراجعة نقاط الحصة والتطبيق عليها بالبيت بهدوء',
    'نأمل منه مزيد من الجهد والمتابعة المنزلية لتحسين الاستيعاب',
    'محتاج مراجعة مستمرة للدروس اللي فاتت عشان ميحصلش تراكم',
    'لازم نهتم أكتر بالمذاكرة اليومية وحفظ الكلمات بانتظام',
    'محتاج تركيز أعلى شوية ومتابعة من البيت عشان يواكب باقي زمايله',
    'هنكثف معاه التطبيقات ومحتاجين مساندة من حضراتكم في متابعة المذاكرة'
  ]
};

export const arabicBaseFemale = {
  excellent: [
    'ما شاء الله مستواها هايل وفاهمة الدرس ومستوعبة كويس جداً',
    'أداء فوق الممتاز وتطبيق عملي ممتاز لكل اللي اتشرح النهاردة',
    'كانت شاطرة جداً ومنورة الحصة ومركزة في كل تفصيلة',
    'استيعابها سريع ومستواها يفرح ما شاء الله ومشاركة بإيجابية',
    'أداء ممتاز وماشية بخطوات ثابتة وواثقة في الألماني',
    'من أشطر الطالبات النهارده، استيعاب سريع وتطبيق دقيق',
    'حصة ممتازة جداً وأداؤها فيها يشرف ويبسط',
    'مستواها يفتح النفس ما شاء الله، لقطت الدرس وطبقته فوراً',
    'أداء رائع ومبهر طول الحصة في كل الأنشطة',
    'ما شاء الله قمة في الشطارة والتركيز في سيشن النهارده',
    'أبدعت في حصة النهارده واستوعبت كل القواعد الجديدة بسهولة',
    'ما شاء الله عليها، كانت متألقة ومستوعبة الشرح من أول دقيقة',
    'أداء ممتاز جداً واستجابة سريعة لكل أسئلة وتدريبات الدرس',
    'طالبة متميزة جداً ومستواها بيكبر ويثبت كل حصة عن اللي قبلها',
    'شغل عالي جداً واستيعاب وفهم ممتاز للغة الألمانية'
  ],
  very_good: [
    'شغالة كويس جداً ومستجيبة بشكل ممتاز مع الشرح والتدريبات',
    'ما شاء الله ماشية بخطوات ممتازة وفاهمة اللي بناخده',
    'مستوى محترم ومتابعة معانا أول بأول بإتقان',
    'أداؤها مريح ومستوعبة النقاط الجديدة في الدرس كويس',
    'كانت شاطرة ومستواها طيب جداً طوال وقت السيشن',
    'أداء جيد جداً ومجهودها واضح ومثمر في الحصة',
    'ماشية برتم ممتاز ومستوعبة أغلب أفكار الدرس باقتدار',
    'استيعابها للدرس كان عالي ومطبقة على التمارين بنجاح',
    'مستوى ممتاز وقريب جداً من الدرجة الكاملة في الفهم والتطبيق',
    'شاطرة ومتابعة الشرح بانتظام وبتجاوب معانا كويس جداً',
    'أداء يفرح ومجهود تشكر عليه في استيعاب المادة',
    'ما شاء الله مستواها ثابت وبيتقدم بخطوات ممتازة'
  ],
  good: [
    'مستواها كويس ومتابعة معانا في الحصة',
    'ماشية تمام ومستوعبة النقاط الأساسية في الدرس',
    'أداء طيب ومتفاعلة في معظم أجزاء السيشن',
    'فاهمة الشرح ومحتاجة تستمر على نفس المستوى وتكثف التدريب',
    'أداؤها كويس ومشاركة معانا في التدريبات',
    'استيعابها لا بأس به وفاهمة الفكرة العامة للدرس',
    'مستوى مرضي وماشية بخطى مقبولة في المنهج',
    'متابعة الشرح كويس وعملت شغل طيب في الحصة',
    'فاهمة المطلوب وبتحاول تطبق معانا خطوة بخطوة',
    'مستوى جيد ومحتاجة تثبيت بالحل والمذاكرة في البيت'
  ],
  developing: [
    'بتتحسن خطوة بخطوة ومحتاجة بس شوية تدريب وحل زيادة',
    'بدأت تستوعب المادة بشكل أحسن ومحتاجين نثبت المعلومات بالمراجعة',
    'مستواها بيتقدم ومحتاجة شوية استمرارية في الحل والمذاكرة أول بأول',
    'بداية كويسة في استيعاب الدرس ومحتاجة تحل تدريبات أكتر في البيت',
    'استيعابها بيتحسن بس محتاجين نراجع الكلمات والقواعد سوا',
    'بتحاول ومستواها في تقدم ومحتاجة شوية تركيز إضافي على النقط الصعبة',
    'محتاجة بس ممارسة أكتر عشان المعلومة تثبت في دماغها وماتترددش',
    'في بوادر فهم كويسة ومحتاجين ندعمها بحل شيتات زيادة',
    'ماشية في طريق التحسن ومحتاجة تكرر الكلمات الجديدة أكتر'
  ],
  needs_support: [
    'محتاجة تشد حيلها شوية في المذاكرة وحل التدريبات أول بأول',
    'محتاجين نركز أكتر الفترة الجاية على مراجعة الكلمات والقواعد وتثبيتها',
    'ستستفيد جداً من مراجعة نقاط الحصة والتطبيق عليها بالبيت بهدوء',
    'نأمل منها مزيد من الجهد والمتابعة المنزلية لتحسين الاستيعاب',
    'محتاجة مراجعة مستمرة للدروس اللي فاتت عشان ميحصلش تراكم',
    'لازم نهتم أكتر بالمذاكرة اليومية وحفظ الكلمات بانتظام',
    'محتاجة تركيز أعلى شوية ومتابعة من البيت عشان تواكب باقي زمايلها',
    'هنكثف معاها التطبيقات ومحتاجين مساندة من حضراتكم في متابعة المذاكرة'
  ]
};

export const arabicParticipationMale = {
  active: [
    'وكان متفاعل جداً وبيجاوب معانا بنشاط وحماس',
    'وحاضر الذهن ومتفاعل مع كل سؤال ونشاط',
    'وشارك بفاعلية وطاقة إيجابية عالية طول الحصة',
    'وكان بيسبق بالحل ومتحمس جداً للتطبيق',
    'وكان رافع إيده ومشارك في كل الألعاب والتدريبات',
    'وتفاعله كان قمة في النشاط والحرص على المشاركة',
    'وكان بيبادر بالإجابة وشعلة نشاط في السيشن',
    'ومشاركته كانت فعالة وممتازة وسط زمايله'
  ],
  good: [
    'وشارك معانا كويس في التطبيقات',
    'وتفاعله كان طيب ومناسب مع أنشطة الحصة',
    'وكان بيجاوب بشكل منظم لما بنسأله',
    'وتفاعل بمستوى كويس ومتابع مجريات الدرس',
    'ومشاركته كانت إيجابية ومتزنة طوال الوقت',
    'وبيرد على الأسئلة كويس ومركز معانا',
    'وحاضر في الحصة وبيشارك وقت طلب الإجابة'
  ],
  quiet: [
    'وكان هادي شوية في الحصة ومحتاج يشارك أكتر تلقائياً',
    'ومشاركته كانت قليلة شوية ومحتاج يتشجع يبادر',
    'رغم هدوئه لكنه كان متابع، ونحب نشوفه بيشارك أكتر',
    'هادي في طبعه ومحتاجين نخليه يرفع إيده ويدخل في الحوار أكتر',
    'كان ساكت شوية والسيشن الجاية هنخليه يشارك أكتر بإذن الله'
  ],
  needs_encouragement: [
    'ومحتاج تشجيع مننا ومن حضراتكم عشان يشارك بجرأة أكتر',
    'ونشجعه يبادر بالسؤال والمشاركة بدون أي تردد أو خجل',
    'ومحتاجين نديله ثقة زيادة عشان يتكلم ويعبر عن نفسه بالألماني',
    'ومهم نشجعه في البيت إنه يسأل ويجاوب بحرية وميقلقش من الغلط'
  ]
};

export const arabicParticipationFemale = {
  active: [
    'وكانت متفاعلة جداً وبتجاوب معانا بنشاط وحماس',
    'وحاضرة الذهن ومتفاعلة مع كل سؤال ونشاط',
    'وشاركت بفاعلية وطاقة إيجابية عالية طول الحصة',
    'وكانت بتسبق بالحل ومتحمسة جداً للتطبيق',
    'وكانت رافعة إيدها ومشاركة في كل الألعاب والتدريبات',
    'وتفاعلها كان قمة في النشاط والحرص على المشاركة',
    'وكانت بتبادر بالإجابة وشعلة نشاط في السيشن',
    'ومشاركتها كانت فعالة وممتازة وسط زميلاتها'
  ],
  good: [
    'وشاركت معانا كويس في التطبيقات',
    'وتفاعلها كان طيب ومناسب مع أنشطة الحصة',
    'وكانت بتجاوب بشكل منظم لما بنسألها',
    'وتفاعلت بمستوى كويس ومتابعة مجريات الدرس',
    'ومشاركتها كانت إيجابية ومتزنة طوال الوقت',
    'وبترد على الأسئلة كويس ومركزة معانا',
    'وحاضرة في الحصة وبتشارك وقت طلب الإجابة'
  ],
  quiet: [
    'وكانت هادية شوية في الحصة ومحتاجة تشارك أكتر تلقائياً',
    'ومشاركتها كانت قليلة شوية ومحتاجة تتشجع تبادر',
    'رغم هدوءها لكنها كانت متابعة، ونحب نشوفها بتشارك أكتر',
    'هادية في طبعها ومحتاجين نخليها ترفع إيدها وتدخل في الحوار أكتر',
    'كانت ساكتة شوية والسيشن الجاية هنخليها تشارك أكتر بإذن الله'
  ],
  needs_encouragement: [
    'ومحتاجة تشجيع مننا ومن حضراتكم عشان تشارك بجرأة أكتر',
    'ونشجعها تبادر بالسؤال والمشاركة بدون أي تردد أو خجل',
    'ومحتاجين نديها ثقة زيادة عشان تتكلم وتعبّر عن نفسها بالألماني',
    'ومهم نشجعها في البيت إنها تسأل وتجاوب بحرية وماتقلقش من الغلط'
  ]
};

export const arabicUnderstandingMale = {
  excellent: [
    'ولقط القواعد والكلمات بسرعة ما شاء الله',
    'وفاهم تفاصيل وتراكيب الدرس كويس جداً',
    'واستيعابه للمفاهيم والشرح كامل بنسبة 100%',
    'وقدر يربط بين الدروس القديمة والجديدة بذكاء',
    'وبيحل التمارين الصعبة بكل سهولة وفهم',
    'وعنده قدرة استيعاب وفهم لغوي عالية جداً'
  ],
  good: [
    'واستيعابه للمحتوى كان تمام ومضبوط',
    'وفاهم الفكرة الأساسية من الدرس كويس',
    'وفاهم أغلب القواعد والكلمات اللي اشتغلنا عليها',
    'واستجابته لمعاني الجمل كانت صحيحة ومنطقية',
    'وقدر يفهم القاعدة ويطبق عليها صح'
  ],
  developing: [
    'وبدأ يربط القواعد أحسن ومحتاج تثبيت بالحل',
    'واستيعابه معقول ومحتاج تكرار عشان المعلومة تثبت أكتر',
    'فاهم جزء كبير بس في تفاصيل محتاجة إعادة مراجعة',
    'بدأ يفهم المعنى العام ومحتاجين نركز على الدقة في القاعدة'
  ],
  needs_review: [
    'ومحتاج يراجع الكلمات الأساسية والقواعد بهدوء',
    'ولازم نراجع معاه النقط اللي محتاجة توضيح وتكرار',
    'محتاجين نثبت معاه الأساسيات الأول عشان يقدر يبني عليها',
    'يفضل يقرأ الملخص اللي بنبعته أكتر من مرة لترسيخ الفهم'
  ]
};

export const arabicUnderstandingFemale = {
  excellent: [
    'ولقطت القواعد والكلمات بسرعة ما شاء الله',
    'وفاهمة تفاصيل وتراكيب الدرس كويس جداً',
    'واستيعابها للمفاهيم والشرح كامل بنسبة 100%',
    'وقدرت تربط بين الدروس القديمة والجديدة بذكاء',
    'وبتحل التمارين الصعبة بكل سهولة وفهم',
    'وعندها قدرة استيعاب وفهم لغوي عالية جداً'
  ],
  good: [
    'واستيعابها للمحتوى كان تمام ومضبوط',
    'وفاهمة الفكرة الأساسية من الدرس كويس',
    'وفاهمة أغلب القواعد والكلمات اللي اشتغلنا عليها',
    'واستجابتها لمعاني الجمل كانت صحيحة ومنطقية',
    'وقدرت تفهم القاعدة وتطبق عليها صح'
  ],
  developing: [
    'وبدأت تربط القواعد أحسن ومحتاجة تثبيت بالحل',
    'واستيعابها معقول ومحتاجة تكرار عشان المعلومة تثبت أكتر',
    'فاهمة جزء كبير بس في تفاصيل محتاجة إعادة مراجعة',
    'بدأت تفهم المعنى العام ومحتاجين نركز على الدقة في القاعدة'
  ],
  needs_review: [
    'ومحتاجة تراجع الكلمات الأساسية والقواعد بهدوء',
    'ولازم نراجع معاها النقط اللي محتاجة توضيح وتكرار',
    'محتاجين نثبت معاها الأساسيات الأول عشان تقدر تبني عليها',
    'يفضل تقرأ الملخص اللي بنبعته أكتر من مرة لترسيخ الفهم'
  ]
};

export const arabicSpeakingMale = {
  confident: [
    'وبينطق الألماني بثقة ومخارج حروف واضحة جداً',
    'وجرأة ممتازة في القراءة والكلام بالألماني',
    'ولسانه بدأ ياخد على نطق الكلمات الألمانية بطلاقة',
    'وما شاء الله نبرة صوته واثقة ونطقه سليم',
    'وبيركب الجمل ويتكلم بطلاقة وسلاسة'
  ],
  good: [
    'ونطق سليم للكلمات والجمل بدون تردد',
    'وبيعرف يعبر عن الجمل بشكل كويس ومفهوم',
    'وقراءته للألماني كويسة وماشية صح',
    'ونطقه للأصوات الألمانية مظبوط ومقبول جداً'
  ],
  improving: [
    'والنطق عنده بيتحسن أحسن بكتير من الأول',
    'وبدأ يتشجع ينطق ويتكلم أكتر في السيشن',
    'قراءته بتتحسن ومحتاج يستمر يقرأ بصوت عالي',
    'بدأ يتغلب على التردد في الكلام وينطق بوضوح'
  ],
  needs_practice: [
    'ومحتاج يقرأ بصوت عالي في البيت لتقوية النطق وتليين اللسان',
    'ولازم يتعود يتكلم بالألماني أكتر بدون خوف من الوقوع في غلط',
    'محتاج يكرر نطق الكلمات مع التسجيلات عشان اللكنة تظبط',
    'هنركز معاه على مهارة التحدث والنطق في الحصص الجاية'
  ]
};

export const arabicSpeakingFemale = {
  confident: [
    'وبتنطق الألماني بثقة ومخارج حروف واضحة جداً',
    'وجرأة ممتازة في القراءة والكلام بالألماني',
    'ولسانها بدأ ياخد على نطق الكلمات الألمانية بطلاقة',
    'وما شاء الله نبرة صوتها واثقة ونطقها سليم',
    'وبتركب الجمل وتتكلم بطلاقة وسلاسة'
  ],
  good: [
    'ونطق سليم للكلمات والجمل بدون تردد',
    'وبتعرف تعبر عن الجمل بشكل كويس ومفهوم',
    'وقراءتها للألماني كويسة وماشية صح',
    'ونطقها للأصوات الألمانية مظبوط ومقبول جداً'
  ],
  improving: [
    'والنطق عندها بيتحسن أحسن بكتير من الأول',
    'وبدأت تتشجع تنطق وتتكلم أكتر في السيشن',
    'قراءتها بتتحسن ومحتاجة تستمر تقرأ بصوت عالي',
    'بدأت تتغلب على التردد في الكلام وتنطق بوضوح'
  ],
  needs_practice: [
    'ومحتاجة تقرأ بصوت عالي في البيت لتقوية النطق وتليين اللسان',
    'ولازم تتعود تتكلم بالألماني أكتر بدون خوف من الوقوع في غلط',
    'محتاجة تكرر نطق الكلمات مع التسجيلات عشان اللكنة تظبط',
    'هنركز معاها على مهارة التحدث والنطق في الحصص الجاية'
  ]
};

export const arabicFocusMale = {
  excellent: [
    'وكان تركيزه عالي ومصحصح طول وقت السيشن ما شاء الله.',
    'ومركز جداً في كل التفاصيل والشرح بدون أي تشتت.',
    'وحاضر بكل حواسه ومنتبه لأدق الملاحظات.',
    'وانتباهه كامل ومفيش ولا معلومة عدت منه النهاردة.'
  ],
  good: [
    'وانتباهه كان تمام ومتابع كويس لأغلب الحصة.',
    'وكان مركز في الجزء الأكبر من السيشن ومستجيب.',
    'ومتابع معايا أول بأول بتركيز طيب ومحترم.',
    'وتركيزه كان مناسب ومستقر طوال الدرس.'
  ],
  sometimes_distracted: [
    'بس بيتشتت في بعض الأوقات ومحتاج يفضل منتبه أكتر.',
    'مع شوية سرحان بسيط ونبهناه يفضل مركز في الشاشة.',
    'تركيزه بيقل شوية في نص الحصة ومحتاج يستمر لنهاية الوقت بنفس القوة.',
    'بيحتاج تذكير بالتركيز أحياناً عشان ميضيعش تسلسل الأفكار.'
  ],
  needs_more_focus: [
    'ومحتاج يركز أكتر ويبعد عن أي مشتتات وقت الحصة تماماً.',
    'ولازم يكون انتباهه أعلى في السيشن الجاية وميقعدش في مكان فيه دوشة.',
    'تشتت انتباهه كتير ومحتاجين بيئة هادية تساعده يستوعب الشرح.',
    'نأمل منه حضور ذهني أعلى والتركيز في الشرح والملاحظات.'
  ]
};

export const arabicFocusFemale = {
  excellent: [
    'وكانت مركزة ومصحصحة طول وقت السيشن ما شاء الله.',
    'ومركزة جداً في كل التفاصيل والشرح بدون أي تشتت.',
    'وحاضرة بكل حواسها ومنتبهة لأدق الملاحظات.',
    'وانتباهها كامل ومفيش ولا معلومة عدت منها النهاردة.'
  ],
  good: [
    'وانتباهها كان تمام ومتابعة كويس لأغلب الحصة.',
    'وكانت مركزة في الجزء الأكبر من السيشن ومستجيبة.',
    'ومتابعة معايا أول بأول بتركيز طيب ومحترم.',
    'وتركيزها كان مناسب ومستقر طوال الدرس.'
  ],
  sometimes_distracted: [
    'بس بتتشتت في بعض الأوقات ومحتاجة تفضل منتبهة أكتر.',
    'مع شوية سرحان بسيط ونبهناها تفضل مركزة في الشاشة.',
    'تركيزها بيقل شوية في نص الحصة ومحتاجة تستمر لنهاية الوقت بنفس القوة.',
    'بتحتاج تذكير بالتركيز أحياناً عشان مايضيعش تسلسل الأفكار.'
  ],
  needs_more_focus: [
    'ومحتاجة تركز أكتر وتبعد عن أي مشتتات وقت الحصة تماماً.',
    'ولازم يكون انتباهها أعلى في السيشن الجاية وماتقعدش في مكان فيه دوشة.',
    'تشتت انتباهها كتير ومحتاجين بيئة هادية تساعدها تستوعب الشرح.',
    'نأمل منها حضور ذهني أعلى والتركيز في الشرح والملاحظات.'
  ]
};

export const arabicProgressMale = {
  improved: [
    'وفي تحسن وتطور واضح عن المرة اللي فاتت، عاش جداً!',
    'وماشي في مسار ممتاز للأمام بإذن الله، برافو عليه.',
    'ومستواه فارق للأحسن بوضوح عن الحصص السابقة، فخور بيه جداً.',
    'وتقدمه ملحوظ ومجهوده في البيت باين على أدائه النهارده.',
    'وما شاء الله الطفرة في مستواه تفرح وإن شاء الله يكمل على كده.',
    'وبإذن الله من تميز لتميز ومكملين للأعلى.'
  ],
  stable: [
    'ومحافظ على مستواه الكويس ومستقر، ربنا يبارك فيه.',
    'ومكملين بنفس الوتيرة المنتظمة والمستوى الثابت.',
    'وأداؤه محافظ على جودته وربنا يوفقه دايماً.',
    'ومستواه طيب ومستمر بثبات في المنهج.'
  ],
  needs_attention: [
    'ومحتاجين شوية اهتمام زيادة عشان نوصل لأحسن نتيجة تناسب إمكانياته.',
    'وبإذن الله مع المتابعة المستمرة في البيت هيفرق معاه جداً.',
    'ومع شوية التزام في الواجبات مستواه هيعلى أكتر بكتير.',
    'وشادين حيلنا معاه عشان يعوض ويبقى في أحسن مستوى.'
  ]
};

export const arabicProgressFemale = {
  improved: [
    'وفي تحسن وتطور واضح عن المرة اللي فاتت، برافو جداً!',
    'وماشية في مسار ممتاز للأمام بإذن الله، شطورة خالص.',
    'ومستواها فارق للأحسن بوضوح عن الحصص السابقة، فخور بيها جداً.',
    'وتقدمها ملحوظ ومجهودها في البيت باين على أدائها النهارده.',
    'وما شاء الله الطفرة في مستواها تفرح وإن شاء الله تكمل على كده.',
    'وبإذن الله من تميز لتميز ومكملين للأعلى.'
  ],
  stable: [
    'ومحافظة على مستواها الكويس ومستقرة، ربنا يبارك فيها.',
    'ومكملين بنفس الوتيرة المنتظمة والمستوى الثابت.',
    'وأداؤها محافظ على جودته وربنا يوفقها دايماً.',
    'ومستواها طيب ومستمرة بثبات في المنهج.'
  ],
  needs_attention: [
    'ومحتاجين شوية اهتمام زيادة عشان نوصل لأحسن نتيجة تناسب إمكانياتها.',
    'وبإذن الله مع المتابعة المستمرة في البيت هيفرق معاها جداً.',
    'ومع شوية التزام في الواجبات مستواها هيعلى أكتر بكتير.',
    'وشادين حيلنا معاها عشان تعوض وتبقى في أحسن مستوى.'
  ]
};

const germanBase = {
  excellent: ['zeigte heute eine hervorragende Leistung', 'hat den Unterrichtsstoff sehr schnell verstanden', 'hat heute ausgezeichnet mitgearbeitet'],
  very_good: ['zeigte heute eine sehr gute Leistung', 'hat sehr gut gearbeitet', 'zeigte durchgehend sehr gute Ergebnisse'],
  good: ['zeigte heute eine gute Leistung', 'hat gut mitgemacht', 'konnte dem Unterricht gut folgen'],
  developing: ['macht gute Fortschritte, braucht aber noch etwas Übung', 'beginnt den Stoff besser zu verstehen'],
  needs_support: ['braucht noch etwas Unterstützung und Übung', 'sollte die heutigen Themen noch einmal wiederholen']
};

const germanParticipation = {
  active: ['und beteiligte sich aktiv am Unterricht', 'und war sehr engagiert'],
  good: ['und machte gut mit', 'und beteiligte sich angemessen'],
  quiet: ['war aber etwas ruhig', 'beteiligte sich jedoch eher zurückhaltend'],
  needs_encouragement: ['und braucht noch etwas Ermutigung, sich mehr zu beteiligen', 'und sollte ermutigt werden, mehr mitzumachen']
};

const germanUnderstanding = {
  excellent: ['Das Verständnis der Themen war exzellent', 'Die Konzepte wurden vollständig verstanden'],
  good: ['Das Verständnis war gut', 'Die Inhalte wurden gut verstanden'],
  developing: ['Das Verständnis entwickelt sich gut', 'Einige Themen sollten noch wiederholt werden'],
  needs_review: ['Einige grundlegende Konzepte müssen noch wiederholt werden', 'Es gibt noch Nachholbedarf beim Verständnis']
};

const germanSpeaking = {
  confident: ['Zudem wurde sehr selbstbewusst gesprochen', 'Das Sprechen fiel leicht und flüssig'],
  good: ['Das Sprechen war gut', 'Gute Ausdrucksweise beim Sprechen'],
  improving: ['Es gab merkliche Fortschritte beim Sprechen', 'Das Sprechen verbessert sich'],
  needs_practice: ['Beim Sprechen ist noch mehr Übung nötig', 'Das freie Sprechen sollte weiter geübt werden']
};

const germanFocus = {
  excellent: ['Die Konzentration war durchgehend hervorragend.', 'Sehr aufmerksam und fokussiert.'],
  good: ['Die Konzentration war gut.', 'Aufmerksam während des Unterrichts.'],
  sometimes_distracted: ['Manchmal gab es leichte Ablenkungen.', 'Die Konzentration ließ gelegentlich nach.'],
  needs_more_focus: ['Es wird mehr Fokus während des Unterrichts benötigt.', 'Mehr Aufmerksamkeit ist empfehlenswert.']
};

const germanProgress = {
  improved: ['Im Vergleich zur letzten Stunde gab es eine deutliche Verbesserung.', 'Tolle Fortschritte gemacht!'],
  stable: ['Das Leistungsniveau ist weiterhin stabil.', 'Macht kontinuierlich weiter so.'],
  needs_attention: ['Wir sollten in Zukunft noch mehr darauf achten, sich zu verbessern.', 'Hier ist noch etwas mehr Einsatz gefragt.']
};

const englishBase = {
  excellent: ['showed excellent performance today', 'grasped the lesson content very quickly', 'did an outstanding job throughout the session'],
  very_good: ['showed very good performance today', 'worked very well', 'showed consistently great results'],
  good: ['showed good performance today', 'did a good job', 'was able to follow the lesson well'],
  developing: ['is making noticeable progress but needs some practice', 'is starting to understand the content better'],
  needs_support: ['needs more support and practice to fully grasp the concepts', 'would benefit from reviewing today’s topics']
};

const englishParticipation = {
  active: ['and participated actively in the activities', 'and was highly engaged'],
  good: ['and participated well', 'and had good involvement'],
  quiet: ['but was a bit quiet', 'but participation was somewhat limited'],
  needs_encouragement: ['and needs some encouragement to participate more', 'and we hope to see more engagement next time']
};

const englishUnderstanding = {
  excellent: ['showing excellent understanding of the material', 'with complete comprehension of the concepts'],
  good: ['showing good understanding of the content', 'with a solid grasp of the lesson'],
  developing: ['with an acceptable understanding, though some review is needed', 'beginning to understand the concepts better'],
  needs_review: ['but needs to review some fundamental concepts', 'and we recommend focusing more on comprehension']
};

const englishSpeaking = {
  confident: ['and spoke with high confidence', 'showing fluent speaking skills'],
  good: ['and spoke well', 'showing good speaking skills'],
  improving: ['with noticeable improvement in speaking', 'showing progress in conversation'],
  needs_practice: ['but needs more practice with speaking', 'and we recommend practicing speaking more']
};

const englishFocus = {
  excellent: ['Maintaining excellent focus throughout.', 'With complete attention during the lesson.'],
  good: ['Maintaining good focus.', 'With good attention.'],
  sometimes_distracted: ['Despite being occasionally distracted.', 'Though focus was lost at times.'],
  needs_more_focus: ['Needs to focus more during explanations.', 'We recommend paying more attention to avoid distractions.']
};

const englishProgress = {
  improved: ['Showing noticeable improvement compared to the last session.', 'Making great progress!'],
  stable: ['Maintaining a stable performance level.', 'Keeping up the consistent work.'],
  needs_attention: ['We hope to see better focus for improved results next time.', 'Requires a bit more effort moving forward.']
};

function pick<T>(arr: T[], avoidIndex?: number): { item: T; index: number } {
  if (!arr || arr.length === 0) return { item: '' as any, index: -1 };
  let pool = arr;
  if (avoidIndex !== undefined && avoidIndex >= 0 && avoidIndex < arr.length && arr.length > 1) {
    pool = arr.filter((_, i) => i !== avoidIndex);
  }
  const randomIdx = Math.floor(Math.random() * pool.length);
  const chosen = pool[randomIdx];
  return { item: chosen, index: arr.indexOf(chosen) };
}

export const generateFeedback = (
  performance: StudentSessionPerformance,
  language: 'ar' | 'en' | 'de' = 'ar',
  avoidVariantId?: string,
  gender: 'male' | 'female' = performance.gender || 'male'
): { feedback: { short: string; parent: string; detailed: string }; variantId: string } => {
  const prevIndices = avoidVariantId ? avoidVariantId.split('-').map(Number) : [];

  let bases: Record<string, string[]>;
  let parts: Record<string, string[]>;
  let unders: Record<string, string[]>;
  let speaks: Record<string, string[]>;
  let focus: Record<string, string[]>;
  let progs: Record<string, string[]>;

  if (language === 'de') {
    bases = germanBase;
    parts = germanParticipation;
    unders = germanUnderstanding;
    speaks = germanSpeaking;
    focus = germanFocus;
    progs = germanProgress;
  } else if (language === 'en') {
    bases = englishBase;
    parts = englishParticipation;
    unders = englishUnderstanding;
    speaks = englishSpeaking;
    focus = englishFocus;
    progs = englishProgress;
  } else {
    // Arabic: choose gender-specific Egyptian dictionary
    if (gender === 'female') {
      bases = arabicBaseFemale;
      parts = arabicParticipationFemale;
      unders = arabicUnderstandingFemale;
      speaks = arabicSpeakingFemale;
      focus = arabicFocusFemale;
      progs = arabicProgressFemale;
    } else {
      bases = arabicBaseMale;
      parts = arabicParticipationMale;
      unders = arabicUnderstandingMale;
      speaks = arabicSpeakingMale;
      focus = arabicFocusMale;
      progs = arabicProgressMale;
    }
  }

  const baseOpts = bases[performance.level || 'good'] || [];
  const partOpts = performance.participation ? parts[performance.participation] || [] : [];
  const underOpts = performance.understanding ? unders[performance.understanding] || [] : [];
  const speakOpts = performance.speaking ? speaks[performance.speaking] || [] : [];
  const focusOpts = performance.focus ? focus[performance.focus] || [] : [];
  const progOpts = performance.progress ? progs[performance.progress] || [] : [];

  const b = pick(baseOpts, prevIndices[0]);
  const p = pick(partOpts, prevIndices[1]);
  const u = pick(underOpts, prevIndices[2]);
  const s = pick(speakOpts, prevIndices[3]);
  const f = pick(focusOpts, prevIndices[4]);
  const pr = pick(progOpts, prevIndices[5]);

  const newVariantId = `${b.index}-${p.index}-${u.index}-${s.index}-${f.index}-${pr.index}`;

  const parentParts: string[] = [];
  if (b.item) parentParts.push(b.item);
  if (p.item) parentParts.push(p.item);
  if (u.item) parentParts.push(u.item);
  if (s.item) parentParts.push(s.item);

  let parentText = parentParts.join(language === 'ar' ? '، ' : ' ');
  if (pr.item) {
    parentText += (parentText ? ' ' : '') + pr.item;
  }

  let detailedText = parentText;
  if (f.item) {
    detailedText += (detailedText ? ' ' : '') + f.item;
  }

  let shortText = '';
  if (language === 'ar') {
    const levelLabel =
      performance.level === 'excellent'
        ? (gender === 'female' ? 'ممتازة وشاطرة جداً' : 'ممتاز وشاطر جداً')
        : performance.level === 'very_good'
        ? (gender === 'female' ? 'شغالة كويس جداً' : 'شغال كويس جداً')
        : performance.level === 'good'
        ? (gender === 'female' ? 'ماشية تمام ومستواها طيب' : 'ماشي تمام ومستواه طيب')
        : (gender === 'female' ? 'محتاجة شوية تدريب' : 'محتاج شوية تدريب');
    shortText = `أداء ${levelLabel} في حصة النهارده. 👍`;
  } else if (language === 'de') {
    shortText = `Heute eine ${
      performance.level === 'excellent'
        ? 'hervorragende'
        : performance.level === 'very_good'
        ? 'sehr gute'
        : performance.level === 'good'
        ? 'gute'
        : 'entwicklungsfähige'
    } Leistung! 👍`;
  } else {
    shortText = `${
      performance.level === 'excellent'
        ? 'Excellent'
        : performance.level === 'very_good'
        ? 'Very good'
        : performance.level === 'good'
        ? 'Good'
        : 'Developing'
    } performance today! 👍`;
  }

  return {
    feedback: {
      short: shortText,
      parent: parentText.trim(),
      detailed: detailedText.trim()
    },
    variantId: newVariantId
  };
};
