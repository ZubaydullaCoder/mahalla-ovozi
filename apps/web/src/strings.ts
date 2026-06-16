// All user-facing Uzbek Cyrillic UI strings go here.
// DO NOT add Latin Uzbek here — will fail check-uz-strings.ts test.
// Use Маҳалла, Бугун, Кеча, Соат, Қидириш — never the Latin equivalents.

export const strings = {
  login: {
    title: 'Маҳалла Овози',
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
  app: {
    title: 'Маҳалла Овози',
    unsupportedScreen: 'Маҳалла Овози фақат компьютер экранида ишлайди',
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
    loading:              'Юкланмоқда...',
    loadErrorTitle:       'Сигналларни юклаб бўлмади',
    loadErrorDescription: 'Саҳифани янгилаб кўринг ёки кейинроқ қайта урининг.',
    senderFallback:       'Резидент',
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
    allMahallas:     'Барча маҳаллалар',
  },

} as const
