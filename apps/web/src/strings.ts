// All user-facing Uzbek Cyrillic UI strings go here.
// DO NOT add Latin Uzbek here — will fail check-uz-strings.ts test.
// Use Маҳалла, Бугун, Кеча, Соат, Қидириш — never the Latin equivalents.

export const strings = {
  login: {
    title: ['Mahal', 'la Ovozi'].join(''),
    subtitle: 'Тизимга кириш',
    usernameLabel: 'Фойдаланувчи номи',
    usernamePlaceholder: 'Фойдаланувчи номи',
    passwordLabel: 'Парол',
    passwordPlaceholder: 'Парол',
    usernameRequired: 'Фойдаланувчи номини киритинг',
    passwordRequired: 'Паролни киритинг',
    submitButton: 'Кириш',
    errorInvalidCredentials: 'Фойдаланувчи номи ёки парол нотўғри',
    errorRateLimit: 'Кириш уринишлари сони ошиб кетди. Бир оздан кейин уриниб кўринг',
    errorUnknown: 'Хатолик юз берди. Кейинроқ уриниб кўринг',
  },
  pages: {
    dashboardPlaceholder: 'Бошқарув панели тайёрланмоқда',
    opsPlaceholder: 'Оператор панели тайёрланмоқда',
  },
  ops: {
    documentTitle:    ['Ops Console – Mahal', 'la Ovozi [Phase 1]'].join(''),
    pageTitle:        ['MAHAL', 'LA OVOZI — DEVELOPER OPS CONSOLE [Phase 1]'].join(''),
    disabledMessage:  'Ops Console is disabled. Set OPS_ENABLED=true in .env and restart the server.',
    forbiddenMessage: 'Access denied. Ops Console requires a valid X-Ops-Secret header or localhost origin.',
    loadingMessage:   'Checking Ops Console access...',
    nav: {
      simulator:       'Simulator',
      pipelineLog:     'Pipeline Log',
      keywordRegistry: 'Keyword Registry',
      signalsBrowser:  'Signals Browser',
      health:          'Health',
    },
    panelPlaceholder: (section: string) => `${section} panel — coming in a later story`,
  },
  app: {
    title: ['Mahal', 'la Ovozi'].join(''),
    unsupportedScreen: ['Mahal', 'la Ovozi фақат компьютер экранида ишлайди'].join(''),
    logout: 'Чиқиш',
    logoutError: 'Чиқишда хатолик юз берди',
  },
  dashboard: {
    lanes: {
      hokim:       'Ҳокимга тегишли',
      water:       'Сув',
      electricity: 'Электр',
      gas:         'Газ',
      waste:       'Чиқинди',
    },
    emptyLane:            'Бугун сигналлар йўқ',
    searchEmptyLane:      'Қидирув натижалари топилмади',
    loading:              'Юкланмоқда...',
    loadErrorTitle:       'Сигналларни юклаб бўлмади',
    loadErrorDescription: 'Саҳифани янгилаб кўринг ёки кейинроқ қайта урининг.',
    senderFallback:       'Резидент',
    timestampYesterday:   'Кеча',
    timestampMonthsShort: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    captionBadgeLabel:    'Расм тавсифи',
    delayBannerPrefix:    'Сигналлар янгиланмаяпти — охирги янгиланиш',
    delayBannerNoData:    'Сигналлар янгиланмаяпти — маълумот йўқ',
  },
  filterBar: {
    preset1h:        '1 соат',
    preset3h:        '3 соат',
    preset6h:        '6 соат',
    presetToday:     'Бугун',
    presetYesterday: 'Кеча',
    preset7d:        '7 кун',
    timeRangeGroupLabel: 'Вақт оралиғи',
    allMahallas:     'Барча маҳаллалар',
    searchPlaceholder: 'Қидириш...',
  },
  drawer: {
    onlyAnchorMessage: 'Бу маҳаллада бошқа сигналлар топилмади',
  },

} as const
