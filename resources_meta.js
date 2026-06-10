/* ============================================================================
 * resources_meta.js — Resource metadata, additional resources, and
 *                     mitigation context for the shadow screening tool.
 *
 * Loaded after data.js. At boot, app.js merges RESOURCE_META into the
 * RESOURCES array and appends ADDITIONAL_RESOURCES.
 * ========================================================================== */

/* IDs of priority "resources of interest" */
const RESOURCES_OF_INTEREST = new Set([
  'pond', 'wollman', 'heckscher-pg', 'heckscher-ballfields',
  'zoo', 'carousel', 'grand-army-plaza',
  'columbus-circle-subway', '5th-59th-subway'
]);

/* ---- Metadata keyed by resource id ----------------------------------------
 * Fields merged onto each RESOURCES entry at boot.                          */
const RESOURCE_META = {
  'pond': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Low',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['ecological/natural resource', 'passive open-space experience'],
    mitigationCandidate: true,
    possibleCritique: 'Recurring shade on The Pond reduces aquatic plant photosynthesis and degrades habitat quality for migratory waterfowl dependent on Hallett Nature Sanctuary.',
    mitigationMeasure: 'Habitat planting, shoreline restoration, ecological monitoring program, maintenance support for Hallett Nature Sanctuary',
    mitigationCategory: 'habitat enhancement', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Moderate', notes: ''
  },
  'wollman': {
    primaryUse: 'rink',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'winter-specific', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: true,
    possibleCritique: 'Winter solstice shadow reduces afternoon solar gain on the rink surface, affecting ice quality and visitor comfort during peak skating hours.',
    mitigationMeasure: 'Covered queue areas, seating upgrades, visitor-comfort improvements, wayfinding enhancements',
    mitigationCategory: 'shelter', roughCostRange: 'Medium',
    implementationPartner: 'NYC Parks', feasibility: 'Moderate', notes: ''
  },
  'heckscher-pg': {
    primaryUse: 'playground',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity'],
    mitigationCandidate: true,
    possibleCritique: 'Incremental shadow on the park\'s largest playground reduces usability for families and children during shoulder-season afternoons.',
    mitigationMeasure: 'Seating and surface upgrades, nearby sunny seating areas, maintenance support for play surfaces',
    mitigationCategory: 'seating', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy / NYC Parks', feasibility: 'Easy', notes: ''
  },
  'heckscher-ballfields': {
    primaryUse: 'sports',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'afternoon',
    impactTheory: ['direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Incremental shadow during afternoon play hours reduces turf health and affects permitted softball/baseball games.',
    mitigationMeasure: 'Schedule adjustments for permitted leagues, turf maintenance support',
    mitigationCategory: 'maintenance support', roughCostRange: 'Low',
    implementationPartner: 'NYC Parks', feasibility: 'Easy', notes: ''
  },
  'chess-checkers': {
    primaryUse: 'destination',
    publicUseSensitivity: 'Medium', useIntensity: 'Low',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience'],
    mitigationCandidate: false,
    possibleCritique: 'Facility is a pavilion with existing roof coverage; incremental shadow impact is limited.',
    mitigationMeasure: 'No mitigation likely warranted.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'dairy': {
    primaryUse: 'destination',
    publicUseSensitivity: 'Medium', useIntensity: 'Low',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Visitor center use is largely indoor; incremental shadow has limited public-use impact.',
    mitigationMeasure: 'No mitigation likely warranted.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'zoo': {
    primaryUse: 'zoo',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'ecological/natural resource'],
    mitigationCandidate: true,
    possibleCritique: 'Incremental shadow on outdoor zoo enclosures affects animal welfare and visitor experience; the sea-lion pool is particularly dependent on direct sunlight.',
    mitigationMeasure: 'Covered queue and viewing areas, seating, wayfinding; habitat lighting review for affected outdoor enclosures',
    mitigationCategory: 'shelter', roughCostRange: 'High',
    implementationPartner: 'Wildlife Conservation Society (WCS) / NYC Parks', feasibility: 'Moderate', notes: ''
  },
  'tisch-zoo': {
    primaryUse: 'zoo',
    publicUseSensitivity: 'High', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity'],
    mitigationCandidate: true,
    possibleCritique: 'Outdoor petting areas are sunlight-dependent for animal welfare and child visitor comfort.',
    mitigationMeasure: 'Covered visitor areas, outdoor seating upgrades, wayfinding',
    mitigationCategory: 'shelter', roughCostRange: 'Medium',
    implementationPartner: 'Wildlife Conservation Society (WCS)', feasibility: 'Moderate', notes: ''
  },
  'sheep-meadow': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'midday',
    impactTheory: ['passive open-space experience', 'direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Shade on the primary sunbathing/passive lawn reduces the park\'s most sun-dependent open space during warm-season peak hours.',
    mitigationMeasure: 'No physical mitigation applicable for large open lawn; shadow impact is inherent to the proposal.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Difficult', notes: ''
  },
  'tavern': {
    primaryUse: 'destination',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: false,
    possibleCritique: 'Outdoor courtyard seating affected by afternoon shadow; private concession operator can self-mitigate.',
    mitigationMeasure: 'Covered outdoor seating, heaters, enhanced lighting for outdoor courtyard',
    mitigationCategory: 'shelter', roughCostRange: 'Low',
    implementationPartner: 'Private concessionaire', feasibility: 'Easy', notes: ''
  },
  'mall': {
    primaryUse: 'circulation',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'passive open-space experience', 'historic/visual resource'],
    mitigationCandidate: false,
    possibleCritique: 'The American elm canopy depends on adequate sun; incremental shade below existing canopy may affect understory health.',
    mitigationMeasure: 'Tree health monitoring, arboricultural support, supplemental pathway lighting',
    mitigationCategory: 'landscaping', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Moderate', notes: ''
  },
  'bethesda': {
    primaryUse: 'destination',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'historic/visual resource'],
    mitigationCandidate: false,
    possibleCritique: 'Bethesda Terrace is a primary photography and gathering destination where light quality is experientially significant.',
    mitigationMeasure: 'Minimal mitigation applicable; shadow impact is inherent to massing.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Difficult', notes: ''
  },
  'lake': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience', 'direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Shading of the lake surface reduces light penetration for aquatic vegetation; affects rowing/gondola experience.',
    mitigationMeasure: 'Aquatic vegetation monitoring; shoreline planting to offset ecological loss',
    mitigationCategory: 'landscaping', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Moderate', notes: ''
  },
  'loeb': {
    primaryUse: 'destination',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: false,
    possibleCritique: 'Outdoor lakeside restaurant deck affected by shadow during prime dining hours.',
    mitigationMeasure: 'Patio heaters, covered seating expansion, enhanced outdoor lighting',
    mitigationCategory: 'shelter', roughCostRange: 'Low',
    implementationPartner: 'Private concessionaire', feasibility: 'Easy', notes: ''
  },
  'conservatory-water': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'afternoon',
    impactTheory: ['passive open-space experience', 'direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Afternoon shadow affects model boat sailing conditions and passive recreational enjoyment.',
    mitigationMeasure: 'Seating upgrades along basin perimeter; enhanced programming during morning hours',
    mitigationCategory: 'seating', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'alice': {
    primaryUse: 'monument/statue',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience', 'direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Limited: some loss of warm afternoon light quality for photography and child play.',
    mitigationMeasure: 'No mitigation warranted.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'strawberry': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience', 'historic/visual resource'],
    mitigationCandidate: false,
    possibleCritique: 'Designated Quiet Zone memorial; incremental shadow affects reflective, passive-use character of the space.',
    mitigationMeasure: 'Enhanced planting, pathway lighting for ambiance',
    mitigationCategory: 'landscaping', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'ramble': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'morning',
    impactTheory: ['ecological/natural resource', 'passive open-space experience'],
    mitigationCandidate: false,
    possibleCritique: 'Critical migratory bird stopover on the Atlantic Flyway; understory light reduction could affect foraging conditions.',
    mitigationMeasure: 'Habitat planting, invasive species management, ecological monitoring',
    mitigationCategory: 'habitat enhancement', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy / NYC Audubon', feasibility: 'Moderate', notes: ''
  },
  'belvedere': {
    primaryUse: 'destination',
    publicUseSensitivity: 'Low', useIntensity: 'Low',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience', 'historic/visual resource'],
    mitigationCandidate: false,
    possibleCritique: 'Limited: hilltop viewpoint unlikely to be substantially affected.',
    mitigationMeasure: 'No mitigation warranted.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'turtle-pond': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Low', useIntensity: 'Low',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['ecological/natural resource', 'passive open-space experience'],
    mitigationCandidate: false,
    possibleCritique: 'Turtle basking depends on direct solar exposure; shade reduces habitat quality for resident turtle population.',
    mitigationMeasure: 'Additional basking structures, shoreline habitat enhancements, ecological monitoring',
    mitigationCategory: 'habitat enhancement', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Easy', notes: ''
  },
  'delacorte': {
    primaryUse: 'destination',
    publicUseSensitivity: 'High', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'afternoon',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: false,
    possibleCritique: 'Afternoon shadow extends the cool-down period before evening Shakespeare performances.',
    mitigationMeasure: 'Enhanced outdoor seating heating, visitor-comfort amenities for pre-performance queuing',
    mitigationCategory: 'shelter', roughCostRange: 'Low',
    implementationPartner: 'The Public Theater / NYC Parks', feasibility: 'Easy', notes: ''
  },
  'great-lawn': {
    primaryUse: 'mixed',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'passive open-space experience'],
    mitigationCandidate: false,
    possibleCritique: 'Incremental shade reduces turf health on 8 ballfields and concert/event lawn; turf requires consistent sun exposure for recovery.',
    mitigationMeasure: 'Enhanced turf management, maintenance support, adjusted event programming',
    mitigationCategory: 'maintenance support', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy / NYC Parks', feasibility: 'Moderate', notes: ''
  },
  'reservoir': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'ecological/natural resource'],
    mitigationCandidate: false,
    possibleCritique: 'Year-round running track; shadow primarily affects early morning and winter runs.',
    mitigationMeasure: 'No physical mitigation applicable for open running path.',
    mitigationCategory: 'other', roughCostRange: 'Low',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Difficult', notes: ''
  },
  'tennis': {
    primaryUse: 'sports',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity'],
    mitigationCandidate: false,
    possibleCritique: 'Uneven light across courts during morning or afternoon shadow windows affects play quality.',
    mitigationMeasure: 'Schedule adjustments, court maintenance support',
    mitigationCategory: 'maintenance support', roughCostRange: 'Low',
    implementationPartner: 'NYC Parks', feasibility: 'Easy', notes: ''
  },
  'north-meadow': {
    primaryUse: 'sports',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'afternoon',
    impactTheory: ['direct human activity'],
    mitigationCandidate: false,
    possibleCritique: '12 permitted ballfields affected by afternoon shadow reduces available play time for youth and adult leagues.',
    mitigationMeasure: 'Enhanced turf maintenance support, adjusted permit scheduling',
    mitigationCategory: 'maintenance support', roughCostRange: 'Low',
    implementationPartner: 'NYC Parks', feasibility: 'Easy', notes: ''
  },
  'conservatory-garden': {
    primaryUse: 'passive landscape',
    publicUseSensitivity: 'Medium', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['passive open-space experience', 'ecological/natural resource'],
    mitigationCandidate: false,
    possibleCritique: 'Formal garden flowering displays are acutely sunlight-dependent; incremental shade reduces bloom quality and season.',
    mitigationMeasure: 'Planting palette adjustment for shade-tolerant species, horticultural support',
    mitigationCategory: 'landscaping', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Moderate', notes: ''
  },
  'harlem-meer': {
    primaryUse: 'mixed',
    publicUseSensitivity: 'High', useIntensity: 'Medium',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'ecological/natural resource'],
    mitigationCandidate: false,
    possibleCritique: 'Serves surrounding Harlem neighborhoods with free fishing and education programs; incremental shadow affects waterfront experience and aquatic habitat.',
    mitigationMeasure: 'Shoreline seating and shade structures, habitat enhancement, lighting upgrades at Dana Discovery Center',
    mitigationCategory: 'seating', roughCostRange: 'Medium',
    implementationPartner: 'Central Park Conservancy', feasibility: 'Moderate', notes: ''
  },
  'lasker': {
    primaryUse: 'mixed',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: true,
    possibleCritique: 'Key free cooling and skating resource for northern Harlem; shadow reduces solar gain on ice and pool comfort.',
    mitigationMeasure: 'Covered seating and spectator areas, visitor comfort amenities, wayfinding',
    mitigationCategory: 'shelter', roughCostRange: 'Medium',
    implementationPartner: 'NYC Parks / Central Park Conservancy', feasibility: 'Moderate', notes: ''
  }
};

/* Additional resources not in the original dataset */
const ADDITIONAL_RESOURCES = [
  {
    id: 'carousel', name: 'Central Park Carousel',
    lat: 40.76848, lng: -73.97279,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks (concession-operated)',
    users: ['Young children & families', 'Tour groups', 'Park visitors'],
    desc: 'Historic carousel near the 65th St mid-park transverse. Outdoor queue and adjacent grounds are sun-exposed gathering spaces.',
    primaryUse: 'destination',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'warm-weather', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'visitor comfort'],
    mitigationCandidate: true,
    possibleCritique: 'Outdoor queue and waiting areas receive incremental shadow during peak family visiting hours.',
    mitigationMeasure: 'Covered queue area, seating, visitor-comfort improvements, wayfinding enhancements',
    mitigationCategory: 'shelter', roughCostRange: 'Medium',
    implementationPartner: 'NYC Parks', feasibility: 'Moderate', notes: '',
    interestResource: true
  },
  {
    id: 'grand-army-plaza', name: 'Grand Army Plaza (SE Entrance)',
    lat: 40.76425, lng: -73.97362,
    type: 'landmark', sunSensitive: true,
    operator: 'NYC Parks / Central Park Conservancy',
    users: ['Park visitors & tourists', 'Commuters & pedestrians', 'Plaza users'],
    desc: 'Formal SE gateway to Central Park at 59th St & 5th Ave, featuring the Pulitzer Fountain and General Sherman statue. Heavily used gateway plaza and public open space.',
    primaryUse: 'destination',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'all day',
    impactTheory: ['direct human activity', 'passive open-space experience', 'historic/visual resource'],
    mitigationCandidate: true,
    possibleCritique: 'Immediately adjacent to Billionaires\' Row towers; likely to receive significant incremental shadow during critical visitor and tourist hours.',
    mitigationMeasure: 'Seating, lighting, planting, paving improvements, wayfinding enhancements for plaza comfort',
    mitigationCategory: 'lighting', roughCostRange: 'High',
    implementationPartner: 'NYC Parks / Central Park Conservancy', feasibility: 'Moderate', notes: '',
    interestResource: true
  },
  {
    id: 'columbus-circle-subway', name: 'Columbus Circle Subway (1/A/B/C/D)',
    lat: 40.76822, lng: -73.98191,
    type: 'institution', sunSensitive: false,
    operator: 'MTA New York City Transit',
    users: ['Daily transit riders', 'Park visitors via subway', 'Commuters'],
    desc: 'Major subway station at Central Park West & 59th St. Open-air entrance plazas are affected by shadow from adjacent development.',
    primaryUse: 'transportation',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'morning',
    impactTheory: ['transportation comfort', 'circulation/safety'],
    mitigationCandidate: true,
    possibleCritique: 'Shadow on near-grade subway entrance plazas reduces ambient light and increases pedestrian discomfort during winter mornings.',
    mitigationMeasure: 'Lighting upgrade at entrance plazas, wind screen, seating in waiting areas',
    mitigationCategory: 'lighting', roughCostRange: 'Medium',
    implementationPartner: 'MTA', feasibility: 'Moderate', notes: '',
    interestResource: true
  },
  {
    id: '5th-59th-subway', name: '5th Ave / 59th St Subway (N/Q/R/W)',
    lat: 40.76443, lng: -73.97299,
    type: 'institution', sunSensitive: false,
    operator: 'MTA New York City Transit',
    users: ['Daily transit riders', 'Park visitors via subway', 'Commuters'],
    desc: 'Subway station at the SE corner of Central Park at 5th Ave & 59th St, adjacent to Grand Army Plaza.',
    primaryUse: 'transportation',
    publicUseSensitivity: 'High', useIntensity: 'High',
    seasonalSensitivity: 'year-round', timeOfDaySensitivity: 'morning',
    impactTheory: ['transportation comfort', 'circulation/safety'],
    mitigationCandidate: true,
    possibleCritique: 'Entrance plaza at base of Billionaires\' Row; new shadow on this heavily trafficked transit node affects thousands of daily riders.',
    mitigationMeasure: 'Lighting upgrade, covered waiting area, seating, wind screen',
    mitigationCategory: 'lighting', roughCostRange: 'Medium',
    implementationPartner: 'MTA / NYC DOT', feasibility: 'Moderate', notes: '',
    interestResource: true
  }
];
