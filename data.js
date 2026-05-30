/* ============================================================================
 * data.js — Central Park sun-sensitive resources + park boundary
 *
 * Curated, offline dataset for shadow analysis. Coordinates are approximate
 * (good to a few meters) and intended for screening-level study, not survey.
 * Each resource carries an OPERATOR (who manages/runs it) and USERS (who
 * actually relies on it) so an incremental shadow can be tied to real people.
 *
 * `type`        category, drives the marker color
 * `sunSensitive` true if CEQR would treat it as a sun-sensitive resource of
 *               interest (open space, natural feature, sunlight-dependent use)
 * ========================================================================== */

/* Central Park boundary — the four street-grid corners (the park is a rotated
 * rectangle: Central Park S / 5th Ave / Central Park N / Central Park W). */
const CENTRAL_PARK_BOUNDARY = [
  [40.7680, -73.9819], // SW — Columbus Circle (Central Park S & CPW)
  [40.7645, -73.9740], // SE — Grand Army Plaza (Central Park S & 5th Ave)
  [40.7967, -73.9495], // NE — Duke Ellington Circle (Central Park N & 5th Ave)
  [40.8005, -73.9583]  // NW — Frederick Douglass Circle (Central Park N & CPW)
];

const CENTRAL_PARK_CENTER = [40.7812, -73.9665];

/* Type → color, used for legend + markers */
const RESOURCE_TYPES = {
  lawn:       { label: 'Open lawn / meadow',     color: '#3aa757' },
  water:      { label: 'Water feature',          color: '#2e86c1' },
  natural:    { label: 'Natural / woodland',     color: '#1e8449' },
  recreation: { label: 'Active recreation',      color: '#e67e22' },
  cultural:   { label: 'Cultural / performance', color: '#8e44ad' },
  landmark:   { label: 'Landmark / monument',    color: '#c0392b' },
  garden:     { label: 'Garden / horticulture',  color: '#16a085' },
  playground: { label: 'Playground',             color: '#d35400' },
  institution:{ label: 'Adjacent institution',   color: '#7f8c8d' }
};

const RESOURCES = [
  // ---- Southern park (most exposed to Billionaires' Row towers) ----
  { id: 'pond', name: 'The Pond & Hallett Nature Sanctuary', lat: 40.7663, lng: -73.9745,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Birdwatchers & Audubon walks', 'Migratory waterfowl habitat', 'General public'],
    desc: 'Naturalistic pond and a 4-acre fenced bird sanctuary at the park’s SE corner. Aquatic plants and habitat are directly sunlight-dependent.' },

  { id: 'wollman', name: 'Wollman Rink', lat: 40.7686, lng: -73.9742,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks (concession-operated)',
    users: ['Public ice skaters (winter)', 'Learn-to-skate programs', 'Spring/summer events'],
    desc: 'Seasonal ice rink. Afternoon sun affects ice quality and patron comfort; winter-solstice shadows are the governing condition.' },

  { id: 'heckscher-pg', name: 'Heckscher Playground', lat: 40.7691, lng: -73.9776,
    type: 'playground', sunSensitive: true,
    operator: 'Central Park Conservancy / NYC Parks',
    users: ['Families with young children', 'Local daycares & schools', 'Summer camps'],
    desc: 'The park’s largest playground. Sunlight on play surfaces matters for warmth and use in shoulder seasons.' },

  { id: 'heckscher-ballfields', name: 'Heckscher Ballfields', lat: 40.7699, lng: -73.9766,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks (permitted)',
    users: ['Adult & youth softball leagues', 'School athletics', 'Pickup games'],
    desc: 'Six ballfields used under NYC Parks permits spring through fall. Turf health and play depend on direct sun.' },

  { id: 'chess-checkers', name: 'Chess & Checkers House', lat: 40.7702, lng: -73.9740,
    type: 'cultural', sunSensitive: false,
    operator: 'Central Park Conservancy',
    users: ['Recreational chess players', 'Visitor center patrons'],
    desc: 'Octagonal pavilion atop the Kinderberg with outdoor game tables.' },

  { id: 'dairy', name: 'The Dairy (Visitor Center)', lat: 40.7700, lng: -73.9728,
    type: 'cultural', sunSensitive: false,
    operator: 'Central Park Conservancy',
    users: ['Park visitors & tourists', 'Conservancy staff'],
    desc: 'Victorian Gothic visitor center and gift shop.' },

  { id: 'zoo', name: 'Central Park Zoo', lat: 40.7678, lng: -73.9718,
    type: 'institution', sunSensitive: true,
    operator: 'Wildlife Conservation Society (WCS)',
    users: ['Zoo visitors & families', 'School field trips', 'Animal collection (welfare)'],
    desc: 'WCS-operated zoo. Several outdoor habitats and the sea-lion pool depend on sunlight for animal welfare and visitor experience.' },

  { id: 'tisch-zoo', name: 'Tisch Children’s Zoo', lat: 40.7688, lng: -73.9712,
    type: 'institution', sunSensitive: true,
    operator: 'Wildlife Conservation Society (WCS)',
    users: ['Young children & families', 'Petting-zoo animals'],
    desc: 'Interactive children’s zoo with outdoor enclosures.' },

  { id: 'sheep-meadow', name: 'Sheep Meadow', lat: 40.7714, lng: -73.9760,
    type: 'lawn', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Sunbathers & picnickers', 'Free-form recreation', 'Designated quiet lawn users'],
    desc: '15-acre designated quiet lawn. The single most sun-dependent open space in the south park — used overwhelmingly for sunbathing and passive recreation.' },

  { id: 'tavern', name: 'Tavern on the Green', lat: 40.7727, lng: -73.9817,
    type: 'institution', sunSensitive: false,
    operator: 'Private concessionaire (NYC Parks license)',
    users: ['Restaurant patrons', 'Event & wedding clients'],
    desc: 'Landmark restaurant on the park’s west side with a sunlit outdoor courtyard.' },

  // ---- The Lake / Bethesda core ----
  { id: 'mall', name: 'The Mall & Literary Walk', lat: 40.7720, lng: -73.9712,
    type: 'landmark', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Strollers & tourists', 'Street performers', 'American elm canopy'],
    desc: 'Formal promenade lined by one of the largest stands of American elms in the country; canopy health is light-dependent.' },

  { id: 'bethesda', name: 'Bethesda Terrace & Fountain', lat: 40.7740, lng: -73.9709,
    type: 'landmark', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Tourists & photographers', 'Wedding & film shoots', 'Musicians'],
    desc: 'The architectural heart of the park. A premier gathering and photography spot where light quality is part of the experience.' },

  { id: 'lake', name: 'The Lake', lat: 40.7760, lng: -73.9725,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Rowboat & gondola riders', 'Waterfowl', 'Shoreline anglers'],
    desc: '20-acre rowing lake. Open water and shoreline vegetation are sunlight-dependent.' },

  { id: 'loeb', name: 'Loeb Boathouse', lat: 40.7757, lng: -73.9686,
    type: 'institution', sunSensitive: false,
    operator: 'Private concessionaire (NYC Parks license)',
    users: ['Restaurant patrons', 'Boat & bike rental customers'],
    desc: 'Lakeside restaurant and boat-rental concession.' },

  { id: 'conservatory-water', name: 'Conservatory Water (Model Boat Pond)', lat: 40.7745, lng: -73.9665,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Central Park Model Yacht Club', 'Model-boat hobbyists', 'Families'],
    desc: 'Formal basin famous for model sailboats; the Model Yacht Club has sailed here for over a century. An afternoon-sun amenity.' },

  { id: 'alice', name: 'Alice in Wonderland Statue', lat: 40.7752, lng: -73.9667,
    type: 'landmark', sunSensitive: false,
    operator: 'Central Park Conservancy',
    users: ['Children & families', 'Tourists'],
    desc: 'Beloved bronze sculpture children climb on, beside Conservatory Water.' },

  { id: 'strawberry', name: 'Strawberry Fields', lat: 40.7756, lng: -73.9750,
    type: 'garden', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Memorial visitors', 'Tour groups', 'Quiet-zone users'],
    desc: 'Landscaped memorial to John Lennon centered on the “Imagine” mosaic; a designated Quiet Zone.' },

  // ---- The Ramble / Belvedere / Great Lawn ----
  { id: 'ramble', name: 'The Ramble', lat: 40.7780, lng: -73.9700,
    type: 'natural', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Birdwatchers (Audubon)', 'Naturalists', 'Migratory songbirds'],
    desc: '38-acre woodland and a top urban birding site on the Atlantic Flyway. Understory plant communities are highly light-sensitive.' },

  { id: 'belvedere', name: 'Belvedere Castle', lat: 40.7794, lng: -73.9692,
    type: 'landmark', sunSensitive: false,
    operator: 'Central Park Conservancy / NWS weather station',
    users: ['Visitors & viewpoint users', 'National Weather Service (Central Park station)'],
    desc: 'Hilltop folly and viewpoint; host to NYC’s official Central Park weather observations.' },

  { id: 'turtle-pond', name: 'Turtle Pond', lat: 40.7798, lng: -73.9682,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Turtles & wildlife', 'Nature observers'],
    desc: 'Pond below Belvedere Castle with a basking dock; aquatic habitat is sunlight-dependent.' },

  { id: 'delacorte', name: 'Delacorte Theater', lat: 40.7800, lng: -73.9685,
    type: 'cultural', sunSensitive: false,
    operator: 'The Public Theater (Shakespeare in the Park)',
    users: ['Free Shakespeare audiences', 'Theater company & crew'],
    desc: 'Open-air theater home to free Shakespeare in the Park. Evening performances — dusk light and ambient warmth matter to programming.' },

  { id: 'great-lawn', name: 'Great Lawn', lat: 40.7812, lng: -73.9665,
    type: 'lawn', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Softball & soccer leagues', 'Concert & festival audiences', 'Sunbathers & picnickers'],
    desc: '55-acre signature lawn with eight ballfields. Heavily programmed for sport and large events; turf and use are sun-dependent.' },

  { id: 'reservoir', name: 'Jacqueline Kennedy Onassis Reservoir', lat: 40.7858, lng: -73.9637,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Runners (1.58-mi track)', 'Birdwatchers', 'Waterfowl'],
    desc: '106-acre reservoir ringed by the park’s most popular running track.' },

  { id: 'tennis', name: 'Central Park Tennis Center', lat: 40.7896, lng: -73.9614,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks (concession-operated)',
    users: ['Permit & drop-in tennis players', 'Lessons & clinics'],
    desc: '30 outdoor courts. Playability depends on direct sun, especially in shoulder seasons.' },

  // ---- Northern park ----
  { id: 'north-meadow', name: 'North Meadow Ballfields', lat: 40.7930, lng: -73.9580,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks (permitted) / Conservancy',
    users: ['Youth & adult sports leagues', 'School athletics', 'Community recreation'],
    desc: '12 ballfields — the park’s largest active-recreation tract, booked through NYC Parks permits.' },

  { id: 'conservatory-garden', name: 'Conservatory Garden', lat: 40.7942, lng: -73.9521,
    type: 'garden', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Garden visitors', 'Wedding photography', 'Horticulture (formal plantings)'],
    desc: 'The park’s only formal garden (6 acres, three styles). Flowering displays are acutely sunlight-dependent.' },

  { id: 'harlem-meer', name: 'Harlem Meer & Dana Discovery Center', lat: 40.7968, lng: -73.9519,
    type: 'water', sunSensitive: true,
    operator: 'Central Park Conservancy',
    users: ['Catch-and-release anglers', 'Harlem community programs', 'Families & nature education'],
    desc: '11-acre lake at the park’s NE corner with a community education center; free fishing and programming for surrounding Harlem neighborhoods.' },

  { id: 'lasker', name: 'Lasker Rink & Pool (Harlem Oval)', lat: 40.7960, lng: -73.9550,
    type: 'recreation', sunSensitive: true,
    operator: 'NYC Parks / Conservancy',
    users: ['Summer swimmers (free pool)', 'Winter skaters', 'Surrounding Harlem community'],
    desc: 'Seasonal pool/rink serving northern neighborhoods (rebuilt as the Harlem Oval). A key free summer cooling resource.' }
];
