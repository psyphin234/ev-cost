/* EV vs Fuel Cost: every default, preset and source lives here.
   calc.js and app.js read from this file; don't hard-code prices elsewhere.
   Prices are rand incl. VAT. "checked" = the date the figure was read from its source. */
window.EV = (function () {
  "use strict";

  var sources = {
    fuelLive: {
      title: "SA Fuel Price Preview: current official pump prices (CEF), updated hourly",
      url: "https://fuel.psyphin.co.za/",
      publisher: "PsyPhin (from the Central Energy Fund's official reports)"
    },
    carmagOct: {
      title: "Confirmed SA fuel price for October 2026",
      url: "https://www.carmag.co.za/news/confirmed-sa-fuel-price-for-october-2026/",
      publisher: "CAR magazine",
      date: "October 2026"
    },
    mybbCharging: {
      title: "New electric car charging company expanding across South Africa, with prices as low as R2.49 per kWh",
      url: "https://mybroadband.co.za/news/motoring/669899-new-electric-car-charging-company-expanding-across-south-africa-with-prices-as-low-as-r2-49-per-kwh.html",
      publisher: "MyBroadband",
      date: "5 October 2026"
    },
    rubiconTariffs: {
      title: "EV charging tariffs in South Africa: what you'll pay to power your EV",
      url: "https://www.rubicon.tech/blogs/news/ev-charging-tariffs-in-south-africa-what-you-ll-pay-to-power-your-ev",
      publisher: "Rubicon",
      date: "August 2025"
    },
    engNewsGridcars: {
      title: "GridCars to deploy truck-charging infrastructure at three highway sites",
      url: "https://www.engineeringnews.co.za/article/gridcars-to-deploy-truck-charging-infrastructure-at-three-highway-sites-2026-06-19",
      publisher: "Engineering News",
      date: "19 June 2026"
    },
    topautoAidc: {
      title: "Electric car charging price increase for motorists living in this South African province",
      url: "https://topauto.co.za/news/157619/electric-car-charging-price-increase-for-motorists-living-in-this-south-african-province/",
      publisher: "TopAuto",
      date: "2026"
    },
    chargeN3: {
      title: "Off-grid EV charging South Africa: Zero Carbon CHARGE N3 stations",
      url: "https://chargepointsa.co.za/off-grid-ev-charging-south-africa-zero-carbon-charge-n3-stations/",
      publisher: "ChargePoint SA",
      date: "2026"
    },
    // CHARGE first sent its tariffs by email, then asked for a link to this page of theirs
    chargeTariff: {
      title: "CHARGE DC charging rates",
      url: "https://charge.co.za/ev-drivers/charge-dc-charging-rates/",
      publisher: "CHARGE",
      date: "October 2026"
    },
    nersa2026: {
      title: "Eskom implements NERSA decision for Financial Year 2027",
      url: "https://www.eskom.co.za/eskom-implements-nersa-decision-for-financial-year-2027/",
      publisher: "Eskom",
      date: "2026"
    },
    enerdataMunicipal: {
      title: "South Africa's energy regulator approves 9% municipal electricity price hike",
      url: "https://www.enerdata.net/publications/daily-energy-news/south-africas-energy-regulator-approves-9-municipal-electricity-price-hike.html",
      publisher: "Enerdata",
      date: "2026"
    },
    stuffEvs: {
      title: "All the electric cars you can buy in South Africa in 2026 for under R1 million",
      url: "https://stuff.co.za/2026/03/17/all-the-electric-cars-you-can-buy-in-sa-2026/",
      publisher: "Stuff South Africa",
      date: "17 March 2026"
    },
    evDatabase: {
      title: "Energy consumption of full electric vehicles cheatsheet",
      url: "https://ev-database.org/cheatsheet/energy-consumption-electric-car",
      publisher: "EV Database",
      date: "checked 13 October 2026"
    },
    evdbCars: {
      title: "Model pages: real energy consumption (city, highway at 110 km/h, combined) and WLTP figures",
      url: "https://ev-database.org/",
      publisher: "EV Database",
      date: "checked 13 October 2026"
    },
    dragEq: {
      title: "The Drag Equation",
      url: "https://www.grc.nasa.gov/www/k-12/rocket/drageq.html",
      publisher: "NASA Glenn Research Center"
    },
    primeRate: {
      title: "SARB raises repo rate to 7.25%: prime lending rate now 10.75%",
      url: "https://briefly.co.za/business-economy/money/254111-sarb-raises-repo-rate-725-what-means-bills-sa/",
      publisher: "Briefly News",
      date: "24 September 2026"
    },
    eskomTariffs: {
      title: "Tariffs and Charges Booklet 2026/2027 (Homepower Standard, page 27; Homelight, page 30)",
      url: "https://www.eskom.co.za/distribution/wp-content/uploads/2026/07/Eskom-Tariff-booklet_Final.pdf",
      publisher: "Eskom",
      date: "2026"
    },
    tshwaneTariffs: {
      title: "Tshwane (Pretoria) electricity tariffs 2026/27, from NERSA's capture of approved tariffs",
      url: "https://gridpulse.org.za/tariffs/tshwane",
      publisher: "GridPulse ZA",
      date: "checked 13 October 2026"
    },
    ethekwiniTariffs: {
      title: "eThekwini electricity tariffs 2026: R4.17 per unit flat rate",
      url: "https://energybee.co.za/news/ethekwini-electricity-tariffs-2026",
      publisher: "EnergyBee",
      date: "2026"
    },
    ncaFees: {
      title: "Initiation fees are all the rage: the National Credit Act's maximum R1,207.50 initiation fee and R69 monthly service fee, charged by all the banks",
      url: "https://www.timeslive.co.za/sunday-times-daily/opinion-and-analysis/2022-02-13-wendy-knowler--initiation-fees-are-all-the-rage--everyones-doing-it-must-you-too/",
      publisher: "Sunday Times (Wendy Knowler)",
      date: "13 February 2022"
    },
    wltpReg: {
      title: "Commission Regulation (EU) 2017/1151 (WLTP): electric energy consumption is measured as energy recharged from the mains",
      url: "https://eur-lex.europa.eu/eli/reg/2017/1151/oj",
      publisher: "European Union"
    }
  };

  /* Fuel prices in R/litre. Used when the live feed can't be reached.
     Petrol is the regulated pump price; diesel is the regulated wholesale price
     (retailers set the diesel pump price, usually a little higher). */
  var fuelFallback = {
    effective: "2026-10-07",
    inland: { petrol95: 30.25, petrol93: 29.88, diesel005: 31.95 },
    coastal: { petrol95: 29.38, petrol93: 29.01, diesel005: 31.08 },
    source: "carmagOct",
    note: "Coastal 93 isn't in the CAR article: it's inland 93 less the same inland/coastal gap as 95 (R0.87)."
  };

  /* The fuel site's status.json gives Gauteng (inland) prices in c/l.
     Coastal = inland minus this gap (the transport zone difference), from the October figures above. */
  var liveFeed = {
    url: "https://fuel.psyphin.co.za/data/status.json",
    fuels: { petrol95: "petrol95", petrol93: "petrol93", diesel005: "diesel005" },
    coastalGap: 0.87
  };

  var fuels = {
    petrol95: { label: "Petrol 95", short: "95" },
    petrol93: { label: "Petrol 93", short: "93" },
    diesel005: { label: "Diesel 50 ppm", short: "Diesel" }
  };

  /* Electricity and charging, R/kWh incl. VAT */
  var tariffs = {
    home: [
      { id: "eskom", label: "Eskom Homepower 4", value: 3.56, source: "eskomTariffs", note: "If Eskom bills you or sells your prepaid units, on the usual single-phase home supply: 355.56 c/kWh incl. VAT for 2026/27 (energy, network demand and ancillary charges). Its fixed daily charges aren't counted: you pay them with or without an EV. Eskom's Homelight 60A prepaid is R3.44." },
      { id: "metro", label: "Metro / municipal", value: 4.50, source: ["tshwaneTariffs", "ethekwiniTariffs"], note: "If your municipality bills you, as most city and suburban homes are. Most metros charge more per kWh the more you use, and an EV's extra 200 to 400 kWh a month lands in your top block: Tshwane's run from R3.73 to R5.12 above 650 kWh a month, while eThekwini charges a flat R4.17. R4.50 is a middle figure: use your own top block's price." },
      { id: "solar", label: "Own solar surplus", value: 0, note: "Daytime charging from panels you already have. The panels aren't free, but the extra kWh is." }
    ],
    publicAc: { value: 5.88, source: "rubiconTariffs", note: "GridCars and Rubicon AC rate for their app's customers." },
    publicDc: { value: 7.35, source: "mybbCharging", note: "GridCars DC rate, the largest network (MyBroadband Oct 2026; Engineering News June 2026 quotes the same)." },
    n3Dc: { value: 9.15, source: "chargeTariff", note: "CHARGE's DC rate at its N3 sites (Reitz and Tugela), from CHARGE itself, October 2026. AC charging there is free until the end of May 2027." },
    examples: [
      { label: "SAEV Charge DC, Cape Town (solar + battery site)", value: "R3.49, or R2.49 when its battery is full", source: "mybbCharging" },
      { label: "AIDC Eastern Cape network, from 1 July 2026", value: "R7.50 (was R7.00)", source: "topautoAidc" },
      { label: "Some branded dealer sites", value: "up to R11.76", source: "mybbCharging" }
    ]
  };

  /* Size classes: set both cars at once so the comparison is like for like.
     Example figures, not from a source: type in your own car's. */
  var classes = [
    { id: "hatch", label: "Small hatch", fuel: "petrol95", lPer100: 6.0, kwhPer100: 14.5, battery: 38 },
    { id: "suv", label: "Compact SUV", fuel: "petrol95", lPer100: 7.5, kwhPer100: 17, battery: 60 },
    { id: "large", label: "Large SUV", fuel: "petrol95", lPer100: 10, kwhPer100: 21, battery: 80 },
    { id: "bakkie", label: "Double-cab bakkie", fuel: "diesel005", lPer100: 9, kwhPer100: 25, battery: 90 }
  ];

  /* What's good or bad for an EV: EV Database's real-world figures across every EV it lists
     ("Data is based on real-world values"; the average is corrected for multiple versions of a model).
     The bands are this page's own grouping around that average, not from the source. */
  var evScale = {
    best: { value: 13.0, car: "Tesla Model 3 RWD" },
    average: 18.9,
    worst: { value: 29.4, car: "Mercedes-Benz G 580" },
    source: "evDatabase",
    bands: [
      { upTo: 15, label: "very efficient", note: "small hatches and sleek sedans" },
      { upTo: 20, label: "about average", note: "most compact SUVs and family cars" },
      { upTo: 25, label: "thirsty", note: "big, heavy SUVs" },
      { upTo: Infinity, label: "very thirsty", note: "large SUVs, bakkies and off-roaders" }
    ]
  };

  /* How much more an EV uses at a steady highway speed. EV Database's model pages give
     "Highway - Mild Weather" (constant 110 km/h, 23 C, no A/C) and "Combined - Mild Weather"
     real-world figures, and the WLTP "Vehicle Consumption" (battery side, without charging losses),
     all in Wh/km. The BMW's WLTP figure is its TEL (lowest-energy spec) value. */
  var highway = {
    speed: 110,
    source: "evdbCars",
    cars: [
      { car: "Tesla Model 3 RWD", url: "https://ev-database.org/car/3740/Tesla-Model-3-RWD", wltp: 105, combined: 110, highway: 135 },
      { car: "BYD Dolphin Surf 30 kWh", url: "https://ev-database.org/car/3193/BYD-DOLPHIN-SURF-30-kWh-Active", wltp: 136, combined: 136, highway: 176 },
      { car: "BYD Atto 3", url: "https://ev-database.org/car/1782/BYD-ATTO-3", wltp: 144, combined: 159, highway: 202 },
      { car: "BMW iX1 eDrive20", url: "https://ev-database.org/car/3458/BMW-iX1-eDrive20", wltp: 126, combined: 142, highway: 176 },
      { car: "Toyota Hilux Electric", url: "https://ev-database.org/car/3652/Toyota-Hilux-Electric-592-kWh", wltp: 210, combined: 240, highway: 309 }
    ],
    // suggested extra, from the middle of the cars above, rounded to 5%
    suggest: { spec: 40, dash: 25 }
  };

  /* Vehicle finance starting point: the prime lending rate. Banks price car loans around prime,
     higher or lower depending on the buyer, so this is a start, not a quote. */
  var finance = { prime: 10.75, since: "25 September 2026", source: "primeRate",
    // the bank's fees on a car loan: the National Credit Act maximums, which the banks charge as standard
    fees: { initiation: 1207.50, monthly: 69, source: "ncaFees" } };

  var routes = [
    { id: "jhb-dbn", label: "Joburg to Durban (N3)", km: 570, n3: true },
    { id: "jhb-pmb", label: "Joburg to Pietermaritzburg (N3)", km: 490, n3: true },
    { id: "jhb-hsmith", label: "Joburg to Harrismith (N3)", km: 275, n3: true },
    { id: "jhb-cpt", label: "Joburg to Cape Town (N1)", km: 1400, n3: false },
    { id: "commute", label: "40 km commute", km: 40, n3: false }
  ];

  var n3Chargers = [
    { name: "CHARGE Reitz Interchange", where: "Free State, N3 exit 107", what: "3 DC fast chargers (6 bays) at R9.15/kWh + 2 AC, free until the end of May 2027", opened: "May 2026", source: ["chargeN3", "chargeTariff"] },
    { name: "CHARGE Tugela", where: "KZN, near Colenso / Winterton, N3 exit 207", what: "3 DC fast chargers (6 bays) at R9.15/kWh + 2 AC, free until the end of May 2027", opened: "May 2026", source: ["chargeN3", "chargeTariff"] }
  ];

  var defaults = {
    region: "inland",
    sizeClass: "suv",
    fuel: "petrol95",
    fuelPrice: null,            // null = current price for the fuel and region
    lPer100: 7.5,
    kwhPer100: 17,
    figureFrom: "spec",         // "spec" (WLTP: already from the wall) or "dash" (add charging losses)
    lossPct: 10,
    homeTariff: "eskom",
    homePrice: 3.56,
    acPrice: 5.88,
    dcPrice: 7.35,
    n3Price: 9.15,              // = tariffs.n3Dc
    mixHome: 80,
    mixAc: 10,
    mixDc: 10,
    kmMonth: 1500,
    // road trip
    route: "jhb-dbn",
    tripKm: 570,
    returnTrip: false,
    battery: 60,
    startPct: 100,
    reservePct: 10,
    chargeToPct: 80,
    highwayPct: 40,             // = highway.suggest.spec
    dcKw: 60,
    // buying
    evPrice: 650000,
    fuelCarPrice: 550000,
    years: 5,
    evService: 3000,
    fuelService: 7000,
    // charging kit: what comes with the car, and what the rest costs (example
    // figures, not from a source). Only what isn't included is added.
    wallboxIncluded: false,
    chargerCost: 15000,         // the wall box, installed
    portableIncluded: true,
    portableCost: 8000,
    v2lIncluded: true,
    v2lCost: 5000,
    fuelRise: 5,
    elecRise: 9,
    // keep the current car, or finance an EV?
    instalment: null,           // null = worked out from the finance below
    finDeposit: 0,
    finRate: 10.75,             // = prime, from 25 Sept 2026
    finMonths: 72,
    finBalloon: 0,
    evIns: 0,
    evServiceMonth: 0,
    oldRepairsMonth: 800
  };

  var assumptions = [
    { id: "wltp", text: "Spec-sheet (WLTP) EV figures are measured at the wall socket, so they already include charging losses. A car's own trip computer shows what the battery delivered, so add 10 to 15% for losses when you use that figure.", source: "wltpReg" },
    { id: "highway", text: "EVs use noticeably more energy at highway speed: air drag rises with the square of speed. EV Database's real-world figures at a steady 110 km/h for five cars are 29 to 47% above their WLTP figures, and 23 to 29% above their real mixed-driving figures, so the trip planner suggests 40% and 25%. At 120 km/h drag is another 19% higher.", source: "evdbCars" },
    { id: "realWorld", text: "Spec-sheet figures are optimistic for everyday driving, for EVs as for fuel cars. EV Database's real mixed-driving figures for the same five cars are 0 to 14% above their WLTP figures (about 10% in the middle), so for a fair answer use real figures for both cars: a trip-computer average, or the spec figure plus about 10%.", source: "evdbCars" },
    { id: "charge80", text: "Fast chargers slow down a lot above about 80%, so the trip planner charges to 80% at each stop by default. The charging time uses an average power you set, not the charger's maximum." },
    { id: "elecRise", text: "NERSA approved a 9.01% average increase for municipal customers from 1 July 2026, and 8.76% for Eskom's direct customers from 1 April 2026. The yearly rises in the ownership view are your choice; these are this year's.", source: "enerdataMunicipal" },
    { id: "diesel", text: "Diesel's price is the regulated wholesale price; filling stations set their own diesel pump price, usually a little higher." },
    { id: "finFees", text: "The worked-out instalment includes the bank's R69 monthly service fee and its R1 207.50 initiation fee, added to the loan: the most the National Credit Act allows, and what the banks charge as standard. A dealer's quote may add more (extras, warranties, credit life cover).", source: "ncaFees" },
    { id: "insurance", text: "A bank requires comprehensive insurance on a car it finances, and a new car costs more to insure than an older one. It isn't in the worked figures: get a quote and enter the extra over what you pay now." },
    { id: "tolls", text: "Tolls, licence fees and parking are left out: they're about the same for both cars." }
  ];

  return {
    sources: sources,
    fuelFallback: fuelFallback,
    liveFeed: liveFeed,
    fuels: fuels,
    tariffs: tariffs,
    classes: classes,
    evScale: evScale,
    finance: finance,
    highway: highway,
    routes: routes,
    n3Chargers: n3Chargers,
    defaults: defaults,
    assumptions: assumptions,
    checked: "2026-10-13"
  };
})();
