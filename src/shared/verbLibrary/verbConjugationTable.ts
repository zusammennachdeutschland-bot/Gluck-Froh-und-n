import { VerbPraesensForms, VerbValidationMetadata } from './verbTypes';

/**
 * Authoritative Duden / Goethe A1–B1 Präsens dictionary for ALL strong, irregular,
 * modal, mixed, and vowel-changing German root verbs (and exact separable/inseparable
 * stem matches). Every stem that exhibits any irregularity in Präsens (or special
 * modal/auxiliary paradigm) is explicitly listed here with all 6 verified forms.
 */
export const EXACT_STEM_CONJUGATIONS: Record<
  string,
  {
    forms: VerbPraesensForms;
    pattern: VerbValidationMetadata['conjugationPattern'];
  }
> = {
  // Auxiliaries & Core Irregulars
  sein: {
    forms: { ich: 'bin', du: 'bist', er_sie_es: 'ist', wir: 'sind', ihr: 'seid', sie_Sie: 'sind' },
    pattern: 'sein_haben_werden'
  },
  haben: {
    forms: { ich: 'habe', du: 'hast', er_sie_es: 'hat', wir: 'haben', ihr: 'habt', sie_Sie: 'haben' },
    pattern: 'sein_haben_werden'
  },
  werden: {
    forms: { ich: 'werde', du: 'wirst', er_sie_es: 'wird', wir: 'werden', ihr: 'werdet', sie_Sie: 'werden' },
    pattern: 'sein_haben_werden'
  },
  tun: {
    forms: { ich: 'tue', du: 'tust', er_sie_es: 'tut', wir: 'tun', ihr: 'tut', sie_Sie: 'tun' },
    pattern: 'irregular'
  },
  wissen: {
    forms: { ich: 'weiß', du: 'weißt', er_sie_es: 'weiß', wir: 'wissen', ihr: 'wisst', sie_Sie: 'wissen' },
    pattern: 'irregular'
  },

  // Modal Verbs
  können: {
    forms: { ich: 'kann', du: 'kannst', er_sie_es: 'kann', wir: 'können', ihr: 'könnt', sie_Sie: 'können' },
    pattern: 'modal'
  },
  müssen: {
    forms: { ich: 'muss', du: 'musst', er_sie_es: 'muss', wir: 'müssen', ihr: 'müsst', sie_Sie: 'müssen' },
    pattern: 'modal'
  },
  dürfen: {
    forms: { ich: 'darf', du: 'darfst', er_sie_es: 'darf', wir: 'dürfen', ihr: 'dürft', sie_Sie: 'dürfen' },
    pattern: 'modal'
  },
  sollen: {
    forms: { ich: 'soll', du: 'sollst', er_sie_es: 'soll', wir: 'sollen', ihr: 'sollt', sie_Sie: 'sollen' },
    pattern: 'modal'
  },
  wollen: {
    forms: { ich: 'will', du: 'willst', er_sie_es: 'will', wir: 'wollen', ihr: 'wollt', sie_Sie: 'wollen' },
    pattern: 'modal'
  },
  mögen: {
    forms: { ich: 'mag', du: 'magst', er_sie_es: 'mag', wir: 'mögen', ihr: 'mögt', sie_Sie: 'mögen' },
    pattern: 'modal'
  },

  // Strong / Vowel-Changing Roots: e -> i
  bergen: {
    forms: { ich: 'berge', du: 'birgst', er_sie_es: 'birgt', wir: 'bergen', ihr: 'bergt', sie_Sie: 'bergen' },
    pattern: 'irregular'
  },
  bersten: {
    forms: { ich: 'berste', du: 'birst', er_sie_es: 'birst', wir: 'bersten', ihr: 'berstet', sie_Sie: 'bersten' },
    pattern: 'irregular'
  },
  brechen: {
    forms: { ich: 'breche', du: 'brichst', er_sie_es: 'bricht', wir: 'brechen', ihr: 'brecht', sie_Sie: 'brechen' },
    pattern: 'irregular'
  },
  dreschen: {
    forms: { ich: 'dresche', du: 'drischst', er_sie_es: 'drischt', wir: 'dreschen', ihr: 'drescht', sie_Sie: 'dreschen' },
    pattern: 'irregular'
  },
  erschrecken: {
    forms: { ich: 'erschrecke', du: 'erschrickst', er_sie_es: 'erschrickt', wir: 'erschrecken', ihr: 'erschreckt', sie_Sie: 'erschrecken' },
    pattern: 'irregular'
  },
  essen: {
    forms: { ich: 'esse', du: 'isst', er_sie_es: 'isst', wir: 'essen', ihr: 'esst', sie_Sie: 'essen' },
    pattern: 'irregular'
  },
  fechten: {
    forms: { ich: 'fechte', du: 'fichtst', er_sie_es: 'ficht', wir: 'fechten', ihr: 'fechtet', sie_Sie: 'fechten' },
    pattern: 'irregular'
  },
  flechten: {
    forms: { ich: 'flechte', du: 'flichtst', er_sie_es: 'flicht', wir: 'flechten', ihr: 'flechtet', sie_Sie: 'flechten' },
    pattern: 'irregular'
  },
  fressen: {
    forms: { ich: 'fresse', du: 'frisst', er_sie_es: 'frisst', wir: 'fressen', ihr: 'fresst', sie_Sie: 'fressen' },
    pattern: 'irregular'
  },
  gebären: {
    forms: { ich: 'gebäre', du: 'gebierst', er_sie_es: 'gebiert', wir: 'gebären', ihr: 'gebärt', sie_Sie: 'gebären' },
    pattern: 'irregular'
  },
  geben: {
    forms: { ich: 'gebe', du: 'gibst', er_sie_es: 'gibt', wir: 'geben', ihr: 'gebt', sie_Sie: 'geben' },
    pattern: 'irregular'
  },
  gelten: {
    forms: { ich: 'gelte', du: 'giltst', er_sie_es: 'gilt', wir: 'gelten', ihr: 'geltet', sie_Sie: 'gelten' },
    pattern: 'irregular'
  },
  helfen: {
    forms: { ich: 'helfe', du: 'hilfst', er_sie_es: 'hilft', wir: 'helfen', ihr: 'helft', sie_Sie: 'helfen' },
    pattern: 'irregular'
  },
  messen: {
    forms: { ich: 'messe', du: 'misst', er_sie_es: 'misst', wir: 'messen', ihr: 'messt', sie_Sie: 'messen' },
    pattern: 'irregular'
  },
  nehmen: {
    forms: { ich: 'nehme', du: 'nimmst', er_sie_es: 'nimmt', wir: 'nehmen', ihr: 'nehmt', sie_Sie: 'nehmen' },
    pattern: 'irregular'
  },
  quellen: {
    forms: { ich: 'quelle', du: 'quillst', er_sie_es: 'quillt', wir: 'quellen', ihr: 'quellt', sie_Sie: 'quellen' },
    pattern: 'irregular'
  },
  schelten: {
    forms: { ich: 'schelte', du: 'schiltst', er_sie_es: 'schilt', wir: 'schelten', ihr: 'scheltet', sie_Sie: 'schelten' },
    pattern: 'irregular'
  },
  schmelzen: {
    forms: { ich: 'schmelze', du: 'schmilzt', er_sie_es: 'schmilzt', wir: 'schmelzen', ihr: 'schmelzt', sie_Sie: 'schmelzen' },
    pattern: 'irregular'
  },
  schwellen: {
    forms: { ich: 'schwelle', du: 'schwillst', er_sie_es: 'schwillt', wir: 'schwellen', ihr: 'schwellt', sie_Sie: 'schwellen' },
    pattern: 'irregular'
  },
  sprechen: {
    forms: { ich: 'spreche', du: 'sprichst', er_sie_es: 'spricht', wir: 'sprechen', ihr: 'sprecht', sie_Sie: 'sprechen' },
    pattern: 'irregular'
  },
  stechen: {
    forms: { ich: 'steche', du: 'stichst', er_sie_es: 'sticht', wir: 'stechen', ihr: 'stecht', sie_Sie: 'stechen' },
    pattern: 'irregular'
  },
  sterben: {
    forms: { ich: 'sterbe', du: 'stirbst', er_sie_es: 'stirbt', wir: 'sterben', ihr: 'sterbt', sie_Sie: 'sterben' },
    pattern: 'irregular'
  },
  treffen: {
    forms: { ich: 'treffe', du: 'triffst', er_sie_es: 'trifft', wir: 'treffen', ihr: 'trefft', sie_Sie: 'treffen' },
    pattern: 'irregular'
  },
  treten: {
    forms: { ich: 'trete', du: 'trittst', er_sie_es: 'tritt', wir: 'treten', ihr: 'tretet', sie_Sie: 'treten' },
    pattern: 'irregular'
  },
  verderben: {
    forms: { ich: 'verderbe', du: 'verdirbst', er_sie_es: 'verdirbt', wir: 'verderben', ihr: 'verderbt', sie_Sie: 'verderben' },
    pattern: 'irregular'
  },
  vergessen: {
    forms: { ich: 'vergesse', du: 'vergisst', er_sie_es: 'vergisst', wir: 'vergessen', ihr: 'vergesst', sie_Sie: 'vergessen' },
    pattern: 'irregular'
  },
  werben: {
    forms: { ich: 'werbe', du: 'wirbst', er_sie_es: 'wirbt', wir: 'werben', ihr: 'werbt', sie_Sie: 'werben' },
    pattern: 'irregular'
  },
  werfen: {
    forms: { ich: 'werfe', du: 'wirfst', er_sie_es: 'wirft', wir: 'werfen', ihr: 'werft', sie_Sie: 'werfen' },
    pattern: 'irregular'
  },
  erlöschen: {
    forms: { ich: 'erlösche', du: 'erlischst', er_sie_es: 'erlischt', wir: 'erlöschen', ihr: 'erlöscht', sie_Sie: 'erlöschen' },
    pattern: 'irregular'
  },
  verlöschen: {
    forms: { ich: 'verlösche', du: 'verlischst', er_sie_es: 'verlischt', wir: 'verlöschen', ihr: 'verlöscht', sie_Sie: 'verlöschen' },
    pattern: 'irregular'
  },

  // Strong / Vowel-Changing Roots: e -> ie
  befehlen: {
    forms: { ich: 'befehle', du: 'befiehlst', er_sie_es: 'befiehlt', wir: 'befehlen', ihr: 'befehlt', sie_Sie: 'befehlen' },
    pattern: 'irregular'
  },
  empfehlen: {
    forms: { ich: 'empfehle', du: 'empfiehlst', er_sie_es: 'empfiehlt', wir: 'empfehlen', ihr: 'empfehlt', sie_Sie: 'empfehlen' },
    pattern: 'irregular'
  },
  geschehen: {
    forms: { ich: 'geschehe', du: 'geschiehst', er_sie_es: 'geschieht', wir: 'geschehen', ihr: 'gescheht', sie_Sie: 'geschehen' },
    pattern: 'irregular'
  },
  lesen: {
    forms: { ich: 'lese', du: 'liest', er_sie_es: 'liest', wir: 'lesen', ihr: 'lest', sie_Sie: 'lesen' },
    pattern: 'irregular'
  },
  sehen: {
    forms: { ich: 'sehe', du: 'siehst', er_sie_es: 'sieht', wir: 'sehen', ihr: 'seht', sie_Sie: 'sehen' },
    pattern: 'irregular'
  },
  stehlen: {
    forms: { ich: 'stehle', du: 'stiehlst', er_sie_es: 'stiehlt', wir: 'stehlen', ihr: 'stehlt', sie_Sie: 'stehlen' },
    pattern: 'irregular'
  },

  // Strong / Vowel-Changing Roots: a -> ä
  backen: {
    forms: { ich: 'backe', du: 'bäckst', er_sie_es: 'bäckt', wir: 'backen', ihr: 'backt', sie_Sie: 'backen' },
    pattern: 'irregular'
  },
  blasen: {
    forms: { ich: 'blase', du: 'bläst', er_sie_es: 'bläst', wir: 'blasen', ihr: 'blast', sie_Sie: 'blasen' },
    pattern: 'irregular'
  },
  braten: {
    forms: { ich: 'brate', du: 'brätst', er_sie_es: 'brät', wir: 'braten', ihr: 'bratet', sie_Sie: 'braten' },
    pattern: 'irregular'
  },
  fahren: {
    forms: { ich: 'fahre', du: 'fährst', er_sie_es: 'fährt', wir: 'fahren', ihr: 'fahrt', sie_Sie: 'fahren' },
    pattern: 'irregular'
  },
  fallen: {
    forms: { ich: 'falle', du: 'fällst', er_sie_es: 'fällt', wir: 'fallen', ihr: 'fallt', sie_Sie: 'fallen' },
    pattern: 'irregular'
  },
  fangen: {
    forms: { ich: 'fange', du: 'fängst', er_sie_es: 'fängt', wir: 'fangen', ihr: 'fangt', sie_Sie: 'fangen' },
    pattern: 'irregular'
  },
  graben: {
    forms: { ich: 'grabe', du: 'gräbst', er_sie_es: 'gräbt', wir: 'graben', ihr: 'grabt', sie_Sie: 'graben' },
    pattern: 'irregular'
  },
  halten: {
    forms: { ich: 'halte', du: 'hältst', er_sie_es: 'hält', wir: 'halten', ihr: 'haltet', sie_Sie: 'halten' },
    pattern: 'irregular'
  },
  laden: {
    forms: { ich: 'lade', du: 'lädst', er_sie_es: 'lädt', wir: 'laden', ihr: 'ladet', sie_Sie: 'laden' },
    pattern: 'irregular'
  },
  lassen: {
    forms: { ich: 'lasse', du: 'lässt', er_sie_es: 'lässt', wir: 'lassen', ihr: 'lasst', sie_Sie: 'lassen' },
    pattern: 'irregular'
  },
  raten: {
    forms: { ich: 'rate', du: 'rätst', er_sie_es: 'rät', wir: 'raten', ihr: 'ratet', sie_Sie: 'raten' },
    pattern: 'irregular'
  },
  schlafen: {
    forms: { ich: 'schlafe', du: 'schläfst', er_sie_es: 'schläft', wir: 'schlafen', ihr: 'schlaft', sie_Sie: 'schlafen' },
    pattern: 'irregular'
  },
  schlagen: {
    forms: { ich: 'schlage', du: 'schlägst', er_sie_es: 'schlägt', wir: 'schlagen', ihr: 'schlagt', sie_Sie: 'schlagen' },
    pattern: 'irregular'
  },
  tragen: {
    forms: { ich: 'trage', du: 'trägst', er_sie_es: 'trägt', wir: 'tragen', ihr: 'tragt', sie_Sie: 'tragen' },
    pattern: 'irregular'
  },
  wachsen: {
    forms: { ich: 'wachse', du: 'wächst', er_sie_es: 'wächst', wir: 'wachsen', ihr: 'wachst', sie_Sie: 'wachsen' },
    pattern: 'irregular'
  },
  waschen: {
    forms: { ich: 'wasche', du: 'wäschst', er_sie_es: 'wäscht', wir: 'waschen', ihr: 'wascht', sie_Sie: 'waschen' },
    pattern: 'irregular'
  },

  // Strong / Vowel-Changing Roots: au -> äu, o -> ö
  laufen: {
    forms: { ich: 'laufe', du: 'läufst', er_sie_es: 'läuft', wir: 'laufen', ihr: 'lauft', sie_Sie: 'laufen' },
    pattern: 'irregular'
  },
  saufen: {
    forms: { ich: 'saufe', du: 'säufst', er_sie_es: 'säuft', wir: 'saufen', ihr: 'sauft', sie_Sie: 'saufen' },
    pattern: 'irregular'
  },
  stoßen: {
    forms: { ich: 'stoße', du: 'stößt', er_sie_es: 'stößt', wir: 'stoßen', ihr: 'stoßt', sie_Sie: 'stoßen' },
    pattern: 'irregular'
  },

  // Inseparable prefixed strong verbs where prefix obscures root if suffix match is greedy
  betreffen: {
    forms: { ich: 'betreffe', du: 'betriffst', er_sie_es: 'betrifft', wir: 'betreffen', ihr: 'betrefft', sie_Sie: 'betreffen' },
    pattern: 'irregular'
  },
  behalten: {
    forms: { ich: 'behalte', du: 'behältst', er_sie_es: 'behält', wir: 'behalten', ihr: 'behaltet', sie_Sie: 'behalten' },
    pattern: 'irregular'
  },
  bekommen: {
    forms: { ich: 'bekomme', du: 'bekommst', er_sie_es: 'bekommt', wir: 'bekommen', ihr: 'bekommt', sie_Sie: 'bekommen' },
    pattern: 'regular'
  },
  beraten: {
    forms: { ich: 'berate', du: 'berätst', er_sie_es: 'berät', wir: 'beraten', ihr: 'beratet', sie_Sie: 'beraten' },
    pattern: 'irregular'
  },
  beschließen: {
    forms: { ich: 'beschließe', du: 'beschließt', er_sie_es: 'beschließt', wir: 'beschließen', ihr: 'beschließt', sie_Sie: 'beschließen' },
    pattern: 's_coalescence'
  },
  besprechen: {
    forms: { ich: 'bespreche', du: 'besprichst', er_sie_es: 'bespricht', wir: 'besprechen', ihr: 'besprecht', sie_Sie: 'besprechen' },
    pattern: 'irregular'
  },
  betragen: {
    forms: { ich: 'betrage', du: 'beträgst', er_sie_es: 'beträgt', wir: 'betragen', ihr: 'betragt', sie_Sie: 'betragen' },
    pattern: 'irregular'
  },
  betreten: {
    forms: { ich: 'betrete', du: 'betrittst', er_sie_es: 'betritt', wir: 'betreten', ihr: 'betretet', sie_Sie: 'betreten' },
    pattern: 'irregular'
  },
  empfangen: {
    forms: { ich: 'empfange', du: 'empfängst', er_sie_es: 'empfängt', wir: 'empfangen', ihr: 'empfangt', sie_Sie: 'empfangen' },
    pattern: 'irregular'
  },
  enthalten: {
    forms: { ich: 'enthalte', du: 'enthältst', er_sie_es: 'enthält', wir: 'enthalten', ihr: 'enthaltet', sie_Sie: 'enthalten' },
    pattern: 'irregular'
  },
  entlassen: {
    forms: { ich: 'entlasse', du: 'entlässt', er_sie_es: 'entlässt', wir: 'entlassen', ihr: 'entlasst', sie_Sie: 'entlassen' },
    pattern: 'irregular'
  },
  erfahren: {
    forms: { ich: 'erfahre', du: 'erfährst', er_sie_es: 'erfährt', wir: 'erfahren', ihr: 'erfahrt', sie_Sie: 'erfahren' },
    pattern: 'irregular'
  },
  erhalten: {
    forms: { ich: 'erhalte', du: 'erhältst', er_sie_es: 'erhält', wir: 'erhalten', ihr: 'erhaltet', sie_Sie: 'erhalten' },
    pattern: 'irregular'
  },
  erraten: {
    forms: { ich: 'errate', du: 'errätst', er_sie_es: 'errät', wir: 'erraten', ihr: 'erratet', sie_Sie: 'erraten' },
    pattern: 'irregular'
  },
  ertragen: {
    forms: { ich: 'ertrage', du: 'erträgst', er_sie_es: 'erträgt', wir: 'ertragen', ihr: 'ertragt', sie_Sie: 'ertragen' },
    pattern: 'irregular'
  },
  erwerben: {
    forms: { ich: 'erwerbe', du: 'erwirbst', er_sie_es: 'erwirbt', wir: 'erwerben', ihr: 'erwerbt', sie_Sie: 'erwerben' },
    pattern: 'irregular'
  },
  gefallen: {
    forms: { ich: 'gefalle', du: 'gefällst', er_sie_es: 'gefällt', wir: 'gefallen', ihr: 'gefallt', sie_Sie: 'gefallen' },
    pattern: 'irregular'
  },
  misslingen: {
    forms: { ich: 'misslinge', du: 'misslingst', er_sie_es: 'misslingt', wir: 'misslingen', ihr: 'misslingt', sie_Sie: 'misslingen' },
    pattern: 'regular'
  },
  missverstehen: {
    forms: { ich: 'missverstehe', du: 'missverstehst', er_sie_es: 'missversteht', wir: 'missverstehen', ihr: 'missversteht', sie_Sie: 'missverstehen' },
    pattern: 'regular'
  },
  überfallen: {
    forms: { ich: 'überfalle', du: 'überfällst', er_sie_es: 'überfällt', wir: 'überfallen', ihr: 'überfallt', sie_Sie: 'überfallen' },
    pattern: 'irregular'
  },
  überlassen: {
    forms: { ich: 'überlasse', du: 'überlässt', er_sie_es: 'überlässt', wir: 'überlassen', ihr: 'überlasst', sie_Sie: 'überlassen' },
    pattern: 'irregular'
  },
  übernehmen: {
    forms: { ich: 'übernehme', du: 'übernimmst', er_sie_es: 'übernimmt', wir: 'übernehmen', ihr: 'übernehmt', sie_Sie: 'übernehmen' },
    pattern: 'irregular'
  },
  überraschen: {
    forms: { ich: 'überrasche', du: 'überraschst', er_sie_es: 'überrascht', wir: 'überraschen', ihr: 'überrascht', sie_Sie: 'überraschen' },
    pattern: 'regular'
  },
  übersehen: {
    forms: { ich: 'übersehe', du: 'übersiehst', er_sie_es: 'übersieht', wir: 'übersehen', ihr: 'überseht', sie_Sie: 'übersehen' },
    pattern: 'irregular'
  },
  übertragen: {
    forms: { ich: 'übertrage', du: 'überträgst', er_sie_es: 'überträgt', wir: 'übertragen', ihr: 'übertragt', sie_Sie: 'übertragen' },
    pattern: 'irregular'
  },
  übertreffen: {
    forms: { ich: 'übertreffe', du: 'übertriffst', er_sie_es: 'übertrifft', wir: 'übertreffen', ihr: 'übertrefft', sie_Sie: 'übertreffen' },
    pattern: 'irregular'
  },
  unterbrechen: {
    forms: { ich: 'unterbreche', du: 'unterbrichst', er_sie_es: 'unterbricht', wir: 'unterbrechen', ihr: 'unterbrecht', sie_Sie: 'unterbrechen' },
    pattern: 'irregular'
  },
  unterhalten: {
    forms: { ich: 'unterhalte', du: 'unterhältst', er_sie_es: 'unterhält', wir: 'unterhalten', ihr: 'unterhaltet', sie_Sie: 'unterhalten' },
    pattern: 'irregular'
  },
  unternehmen: {
    forms: { ich: 'unternehme', du: 'unternimmst', er_sie_es: 'unternimmt', wir: 'unternehmen', ihr: 'unternehmt', sie_Sie: 'unternehmen' },
    pattern: 'irregular'
  },
  unterstützen: {
    forms: { ich: 'unterstütze', du: 'unterstützt', er_sie_es: 'unterstützt', wir: 'unterstützen', ihr: 'unterstützt', sie_Sie: 'unterstützen' },
    pattern: 's_coalescence'
  },
  verbergen: {
    forms: { ich: 'verberge', du: 'verbirgst', er_sie_es: 'verbirgt', wir: 'verbergen', ihr: 'verbergt', sie_Sie: 'verbergen' },
    pattern: 'irregular'
  },
  verbrechen: {
    forms: { ich: 'verbreche', du: 'verbrichst', er_sie_es: 'verbricht', wir: 'verbrechen', ihr: 'verbrecht', sie_Sie: 'verbrechen' },
    pattern: 'irregular'
  },
  verfallen: {
    forms: { ich: 'verfalle', du: 'verfällst', er_sie_es: 'verfällt', wir: 'verfallen', ihr: 'verfallt', sie_Sie: 'verfallen' },
    pattern: 'irregular'
  },
  vergeben: {
    forms: { ich: 'vergebe', du: 'vergibst', er_sie_es: 'vergibt', wir: 'vergeben', ihr: 'vergebt', sie_Sie: 'vergeben' },
    pattern: 'irregular'
  },
  verhalten: {
    forms: { ich: 'verhalte', du: 'verhältst', er_sie_es: 'verhält', wir: 'verhalten', ihr: 'verhaltet', sie_Sie: 'verhalten' },
    pattern: 'irregular'
  },
  verlassen: {
    forms: { ich: 'verlasse', du: 'verlässt', er_sie_es: 'verlässt', wir: 'verlassen', ihr: 'verlasst', sie_Sie: 'verlassen' },
    pattern: 'irregular'
  },
  verlaufen: {
    forms: { ich: 'verlaufe', du: 'verläufst', er_sie_es: 'verläuft', wir: 'verlaufen', ihr: 'verlauft', sie_Sie: 'verlaufen' },
    pattern: 'irregular'
  },
  verraten: {
    forms: { ich: 'verrate', du: 'verrätst', er_sie_es: 'verrät', wir: 'verraten', ihr: 'verratet', sie_Sie: 'verraten' },
    pattern: 'irregular'
  },
  verschlafen: {
    forms: { ich: 'verschlafe', du: 'verschläfst', er_sie_es: 'verschläft', wir: 'verschlafen', ihr: 'verschlaft', sie_Sie: 'verschlafen' },
    pattern: 'irregular'
  },
  versprechen: {
    forms: { ich: 'verspreche', du: 'versprichst', er_sie_es: 'verspricht', wir: 'versprechen', ihr: 'versprecht', sie_Sie: 'versprechen' },
    pattern: 'irregular'
  },
  verstoßen: {
    forms: { ich: 'verstoße', du: 'verstößt', er_sie_es: 'verstößt', wir: 'verstoßen', ihr: 'verstoßt', sie_Sie: 'verstoßen' },
    pattern: 'irregular'
  },
  vertragen: {
    forms: { ich: 'vertrage', du: 'verträgst', er_sie_es: 'verträgt', wir: 'vertragen', ihr: 'vertragt', sie_Sie: 'vertragen' },
    pattern: 'irregular'
  },
  vertreten: {
    forms: { ich: 'vertrete', du: 'vertrittst', er_sie_es: 'vertritt', wir: 'vertreten', ihr: 'vertretet', sie_Sie: 'vertreten' },
    pattern: 'irregular'
  },
  verwerfen: {
    forms: { ich: 'verwerfe', du: 'verwirfst', er_sie_es: 'verwirft', wir: 'verwerfen', ihr: 'verwerft', sie_Sie: 'verwerfen' },
    pattern: 'irregular'
  },
  zerbrechen: {
    forms: { ich: 'zerbreche', du: 'zerbrichst', er_sie_es: 'zerbricht', wir: 'zerbrechen', ihr: 'zerbrecht', sie_Sie: 'zerbrechen' },
    pattern: 'irregular'
  },
  // Non-stem-changing inseparable / orthographic edge cases (prevent false root match e.g. handhaben vs haben, verladen vs laden is actually a->ä so leave verladen!)
  handhaben: {
    forms: { ich: 'handhabe', du: 'handhabst', er_sie_es: 'handhabt', wir: 'handhaben', ihr: 'handhabt', sie_Sie: 'handhaben' },
    pattern: 'regular'
  },
  veranlassen: {
    forms: { ich: 'veranlasse', du: 'veranlasst', er_sie_es: 'veranlasst', wir: 'veranlassen', ihr: 'veranlasst', sie_Sie: 'veranlassen' },
    pattern: 's_coalescence'
  },
  // Regular verbs whose endings happen to look like irregular roots (e.g. baden vs laden, schaden vs laden, schaffen regular in Präsens)
  baden: {
    forms: { ich: 'bade', du: 'badest', er_sie_es: 'badet', wir: 'baden', ihr: 'badet', sie_Sie: 'baden' },
    pattern: 'epenthetic_e'
  },
  schaden: {
    forms: { ich: 'schade', du: 'schadest', er_sie_es: 'schadet', wir: 'schaden', ihr: 'schadet', sie_Sie: 'schaden' },
    pattern: 'epenthetic_e'
  },
  schaffen: {
    forms: { ich: 'schaffe', du: 'schaffst', er_sie_es: 'schafft', wir: 'schaffen', ihr: 'schafft', sie_Sie: 'schaffen' },
    pattern: 'regular'
  },
  erschaffen: {
    forms: { ich: 'erschaffe', du: 'erschaffst', er_sie_es: 'erschafft', wir: 'erschaffen', ihr: 'erschafft', sie_Sie: 'erschaffen' },
    pattern: 'regular'
  },
  verschaffen: {
    forms: { ich: 'verschaffe', du: 'verschaffst', er_sie_es: 'verschafft', wir: 'verschaffen', ihr: 'verschafft', sie_Sie: 'verschaffen' },
    pattern: 'regular'
  }
};

// Inseparable prefixes in standard German that attach directly to strong roots
const INSEPARABLE_PREFIXES = [
  'be',
  'emp',
  'ent',
  'er',
  'ge',
  'miss',
  'ver',
  'zer',
  'hinter',
  'über',
  'unter',
  'um',
  'durch',
  'voll',
  'wieder',
  'wider'
];

// False-root exceptions where an inseparable verb shares letters with a strong root but conjugates regularly
const REGULAR_INF_OVERRIDES = new Set<string>([
  'handhaben',
  'veranlassen',
  'entdecken',
  'verstecken',
  'erschrecken_tr',
  'bewerten',
  'entwerten',
  'verwerten',
  'erwarten',
  'bewahren',
  'erfahren_n',
  'begehren',
  'entbehren',
  'verehren',
  'bewähren',
  'gewähren',
  'bescheren',
  'erklären',
  'verklären',
  'ernähren',
  'verjähren',
  'erzählen',
  'bezahlen',
  'vermahlen',
  'bestrahlen',
  'entfalten',
  'gestalten',
  'verwalten',
  'spalten',
  'schalten',
  'falten',
  'mahlen',
  'zahlen',
  'prahlen',
  'strahlen',
  'malen',
  'quälen',
  'wählen',
  'zählen',
  'stählen',
  'fehlen',
  'hehlen',
  'heilen',
  'teilen',
  'eilen',
  'weilen',
  'feilen',
  'peilen',
  'zielen',
  'spielen',
  'spülen',
  'fühlen',
  'kühlen',
  'wühlen',
  'mühlen',
  'kaufen',
  'taufen',
  'raufen',
  'häufen',
  'träufen',
  'strafen',
  'gaffen',
  'raffen',
  'schlafen_n',
  'klagen',
  'nagen',
  'plagen',
  'ragen',
  'sagen',
  'tagen',
  'wagen',
  'fragen',
  'jagen',
  'agen',
  'schlagen_n',
  'pflegen',
  'regen',
  'legen',
  'hegen',
  'fegen',
  'wägen',
  'sägen',
  'prägen',
  'schrägen',
  'bewegen',
  'aufregen',
  'überlegen',
  'verlegen',
  'belegen',
  'erlegen',
  'widerlegen',
  'zerlegen',
  'verpflegen',
  'warten',
  'starten',
  'härten',
  'garten',
  'bitten_reg',
  'beten',
  'treten_n',
  'reden',
  'baden',
  'schaden',
  'fahnden',
  'ahnden',
  'senden',
  'wenden',
  'blenden',
  'spenden',
  'enden',
  'verschwinden_reg',
  'künden',
  'gründen',
  'münden',
  'zünden',
  'pfänden',
  'schänden',
  'landen',
  'stranden',
  'handeln',
  'wandeln',
  'verwandeln',
  'behandeln',
  'messen_n',
  'pressen',
  'fesseln',
  'kesseln',
  'bessern',
  'wässern',
  'äußern',
  'veräußern',
  'hassen',
  'passen',
  'verpassen',
  'anpassen',
  'aufpassen',
  'fassen',
  'erfassen',
  'umfassen',
  'verfassen',
  'zusammenfassen',
  'spaßen',
  'stoßen_n',
  'losen',
  'kosen',
  'tosen',
  'reisen',
  'speisen',
  'preisen',
  'weisen',
  'beweisen',
  'hinweisen',
  'nachweisen',
  'abwesen',
  'genesen',
  'verlesen_n',
  'kochen',
  'pochen',
  'lochen',
  'rauchen',
  'brauchen',
  'gebrauchen',
  'verbrauchen',
  'missbrauchen',
  'tauchen',
  'hauchen',
  'lauern',
  'dauern',
  'bedauern',
  'trauern',
  'mauern',
  'feiern',
  'steuern',
  'teuern',
  'beteuern',
  'scheuern',
  'erneuern',
  'erinnern',
  'verhindern',
  'mindern',
  'lindern',
  'ändern',
  'verändern',
  'wandern',
  'wundern',
  'bewundern',
  'fördern',
  'fordern',
  'aufordern',
  'auffordern',
  'herausfordern',
  'überfordern',
  'klettern',
  'zittern',
  'füttern',
  'wittern',
  'splittern',
  'blättern',
  'ergattern',
  'flattern',
  'klingeln',
  'sammeln',
  'lächeln',
  'wechseln',
  'basteln',
  'bügeln',
  'zweifeln',
  'entwickeln',
  'regeln',
  'segeln',
  'spiegeln',
  'streicheln',
  'angeln',
  'betteln',
  'schütteln',
  'rütteln',
  'ermitteln',
  'vermitteln',
  'vereiteln',
  'urteilen',
  'beurteilen',
  'verurteilen',
  'krümeln',
  'bummeln',
  'tummeln',
  'schummeln',
  'stempeln',
  'strampeln',
  'krempeln',
  'trampeln',
  'rascheln',
  'kuscheln',
  'tuscheln',
  'nuscheln',
  'murmeln',
  'grübeln',
  'jubeln',
  'kurbeln',
  'hobeln',
  'paddeln',
  'radeln',
  'rodeln',
  'tadeln',
  'wedeln',
  'nörgeln',
  'orgeln',
  'kegeln',
  'riegeln',
  'verriegeln',
  'entriegeln',
  'siegeln',
  'versiegeln',
  'prasseln',
  'rasseln',
  'prickeln',
  'wickeln',
  'abwickeln',
  'einwickeln',
  'verwickeln',
  'schaukeln',
  'gaukeln',
  'makeln',
  'funkeln',
  'dunkeln',
  'munkeln',
  'schmunzeln',
  'runzeln',
  'blinzeln',
  'brutzeln',
  'purzeln',
  'stürzen'
]);

const BASE_IRREGULAR_KEYS = Object.keys(EXACT_STEM_CONJUGATIONS).sort(
  (a, b) => b.length - a.length
);

/**
 * Resolves the exact 6 Präsens stem forms for an unprefixed or inseparably-prefixed stem infinitive.
 * Used at catalog build-time to materialize pre-validated 6-form `praesens` entries on every verb.
 */
export function resolveStemPraesens(stemInfinitiveRaw: string): {
  forms: VerbPraesensForms;
  pattern: VerbValidationMetadata['conjugationPattern'];
} {
  const inf = stemInfinitiveRaw.trim().toLowerCase();

  if (EXACT_STEM_CONJUGATIONS[inf]) {
    return EXACT_STEM_CONJUGATIONS[inf];
  }

  // Check if inf is an inseparable prefix + known irregular root (e.g. "empfehlen", "verlassen", "versprechen", "begraben", "entwerfen")
  if (!REGULAR_INF_OVERRIDES.has(inf)) {
    for (const prefix of INSEPARABLE_PREFIXES) {
      if (inf.startsWith(prefix)) {
        const remainder = inf.slice(prefix.length);
        if (EXACT_STEM_CONJUGATIONS[remainder]) {
          const base = EXACT_STEM_CONJUGATIONS[remainder];
          return {
            forms: {
              ich: prefix + base.forms.ich,
              du: prefix + base.forms.du,
              er_sie_es: prefix + base.forms.er_sie_es,
              wir: prefix + base.forms.wir,
              ihr: prefix + base.forms.ihr,
              sie_Sie: prefix + base.forms.sie_Sie
            },
            pattern: base.pattern
          };
        }
      }
    }
    // Check double-prefixed compounds like "verabschieden", "beauftragen", "benachrichtigen", "beantworten"
    // or compound irregulars like "teilnehmen" (already split as separable stem "nehmen")
    for (const root of BASE_IRREGULAR_KEYS) {
      if (root.length >= 4 && inf.endsWith(root) && inf.length > root.length) {
        const leading = inf.slice(0, inf.length - root.length);
        // Only apply root conjugation when leading is a true prefix like be-, ver-, er-, ent-, emp-, zer-, miss-, ge-
        if (INSEPARABLE_PREFIXES.includes(leading)) {
          const base = EXACT_STEM_CONJUGATIONS[root];
          return {
            forms: {
              ich: leading + base.forms.ich,
              du: leading + base.forms.du,
              er_sie_es: leading + base.forms.er_sie_es,
              wir: leading + base.forms.wir,
              ihr: leading + base.forms.ihr,
              sie_Sie: leading + base.forms.sie_Sie
            },
            pattern: base.pattern
          };
        }
      }
    }
  }

  // Regular Weak Morphology Rules (Duden Orthography)
  if (inf.endsWith('eln')) {
    const base = inf.slice(0, -1); // e.g. "klingel", "sammel"
    const stemEl = inf.slice(0, -3); // e.g. "kling", "samm"
    return {
      forms: {
        ich: `${stemEl}le`,
        du: `${base}st`,
        er_sie_es: `${base}t`,
        wir: inf,
        ihr: `${base}t`,
        sie_Sie: inf
      },
      pattern: 'eln_ern'
    };
  }

  if (inf.endsWith('ern')) {
    const base = inf.slice(0, -1); // e.g. "wander", "feier"
    return {
      forms: {
        ich: `${base}e`,
        du: `${base}st`,
        er_sie_es: `${base}t`,
        wir: inf,
        ihr: `${base}t`,
        sie_Sie: inf
      },
      pattern: 'eln_ern'
    };
  }

  // Standard -en ending (or -n)
  const stem = inf.endsWith('en') ? inf.slice(0, -2) : inf.slice(0, -1);

  // Epenthetic -e- required after -d, -t, -chn, or true consonant (not vowel/h/l/r/m/n) + m/n
  const needsEpentheticE =
    /[dt]$/.test(stem) ||
    /(?:chn|[^aeiouäöüyhlrmn][mn])$/.test(stem);

  const isSCoalescence = /[sßxz]$/.test(stem);

  if (needsEpentheticE) {
    return {
      forms: {
        ich: `${stem}e`,
        du: `${stem}est`,
        er_sie_es: `${stem}et`,
        wir: inf,
        ihr: `${stem}et`,
        sie_Sie: inf
      },
      pattern: 'epenthetic_e'
    };
  }

  if (isSCoalescence) {
    return {
      forms: {
        ich: `${stem}e`,
        du: `${stem}t`,
        er_sie_es: `${stem}t`,
        wir: inf,
        ihr: `${stem}t`,
        sie_Sie: inf
      },
      pattern: 's_coalescence'
    };
  }

  return {
    forms: {
      ich: `${stem}e`,
      du: `${stem}st`,
      er_sie_es: `${stem}t`,
      wir: inf,
      ihr: `${stem}t`,
      sie_Sie: inf
    },
    pattern: 'regular'
  };
}

export const REFLEXIVE_AKK = {
  ich: 'mich',
  du: 'dich',
  er_sie_es: 'sich',
  wir: 'uns',
  ihr: 'euch',
  sie_Sie: 'sich'
} as const;

export const REFLEXIVE_DAT = {
  ich: 'mir',
  du: 'dir',
  er_sie_es: 'sich',
  wir: 'uns',
  ihr: 'euch',
  sie_Sie: 'sich'
} as const;

export function buildFullVerbPraesens(opts: {
  stemInfinitive: string;
  separablePrefix?: string;
  isReflexive: boolean;
  reflexiveCase?: 'Akkusativ' | 'Dativ';
}): {
  praesens: VerbPraesensForms;
  pattern: VerbValidationMetadata['conjugationPattern'];
} {
  const { forms, pattern } = resolveStemPraesens(opts.stemInfinitive);
  const reflTable = opts.reflexiveCase === 'Dativ' ? REFLEXIVE_DAT : REFLEXIVE_AKK;

  const formatSlot = (slot: keyof VerbPraesensForms): string => {
    const finite = forms[slot];
    const parts: string[] = [finite];
    if (opts.isReflexive) {
      parts.push(reflTable[slot]);
    }
    if (opts.separablePrefix) {
      parts.push(opts.separablePrefix);
    }
    return parts.join(' ');
  };

  return {
    praesens: {
      ich: formatSlot('ich'),
      du: formatSlot('du'),
      er_sie_es: formatSlot('er_sie_es'),
      wir: formatSlot('wir'),
      ihr: formatSlot('ihr'),
      sie_Sie: formatSlot('sie_Sie')
    },
    pattern
  };
}
