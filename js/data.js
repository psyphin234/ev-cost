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
      { id: "eskom", label: "Eskom Homepower 4", value: 3.56, source: "mybbCharging", note: "Eskom direct customers, as quoted in October 2026." },
      { id: "metro", label: "Metro / municipal", value: 4.50, source: "mybbCharging", note: "Tshwane residential is R4 to R5 per kWh (MyBroadband, Oct 2026): this is the middle. Check your own bill: block tariffs cost more the more you use." },
      { id: "solar", label: "Own solar surplus", value: 0, note: "Daytime charging from panels you already have. The panels aren't free, but the extra kWh is." }
    ],
    publicAc: { value: 5.88, source: "rubiconTariffs", note: "GridCars and Rubicon AC rate for their app's customers." },
    publicDc: { value: 7.35, source: "mybbCharging", note: "GridCars DC rate, the largest network (MyBroadband Oct 2026; Engineering News June 2026 quotes the same)." },
    n3Dc: { value: 7.35, source: "chargeN3", note: "CHARGE hasn't published its N3 tariff, so this assumes the GridCars DC rate. Check the operator's app before you go." },
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

  var routes = [
    { id: "jhb-dbn", label: "Joburg to Durban (N3)", km: 570, n3: true },
    { id: "jhb-pmb", label: "Joburg to Pietermaritzburg (N3)", km: 490, n3: true },
    { id: "jhb-hsmith", label: "Joburg to Harrismith (N3)", km: 275, n3: true },
    { id: "jhb-cpt", label: "Joburg to Cape Town (N1)", km: 1400, n3: false },
    { id: "commute", label: "40 km commute", km: 40, n3: false }
  ];

  var n3Chargers = [
    { name: "CHARGE Reitz Interchange", where: "Free State, N3 exit 107", what: "3 DC fast chargers (6 bays) + 2 AC", opened: "May 2026", source: "chargeN3" },
    { name: "CHARGE Tugela", where: "KZN, near Colenso / Winterton, N3 exit 207", what: "3 DC fast chargers (6 bays) + 2 AC", opened: "May 2026", source: "chargeN3" }
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
    n3Price: 7.35,
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
    highwayPct: 20,
    dcKw: 60,
    // buying
    evPrice: 650000,
    fuelCarPrice: 550000,
    years: 5,
    evService: 3000,
    fuelService: 7000,
    chargerCost: 15000,
    fuelRise: 5,
    elecRise: 9
  };

  var assumptions = [
    { id: "wltp", text: "Spec-sheet (WLTP) EV figures are measured at the wall socket, so they already include charging losses. A car's own trip computer shows what the battery delivered, so add 10 to 15% for losses when you use that figure.", source: "wltpReg" },
    { id: "highway", text: "EVs use noticeably more energy at 120 km/h than in mixed driving (air drag rises with the square of speed), while fuel cars change less. The trip planner adds a percentage you can change; 20% is an example, not a published figure." },
    { id: "charge80", text: "Fast chargers slow down a lot above about 80%, so the trip planner charges to 80% at each stop by default. The charging time uses an average power you set, not the charger's maximum." },
    { id: "elecRise", text: "NERSA approved a 9.01% average increase for municipal customers from 1 July 2026, and 8.76% for Eskom's direct customers from 1 April 2026. The yearly rises in the ownership view are your choice; these are this year's.", source: "enerdataMunicipal" },
    { id: "diesel", text: "Diesel's price is the regulated wholesale price; filling stations set their own diesel pump price, usually a little higher." },
    { id: "tolls", text: "Tolls, licence fees and parking are left out: they're about the same for both cars." }
  ];

  return {
    sources: sources,
    fuelFallback: fuelFallback,
    liveFeed: liveFeed,
    fuels: fuels,
    tariffs: tariffs,
    classes: classes,
    routes: routes,
    n3Chargers: n3Chargers,
    defaults: defaults,
    assumptions: assumptions,
    checked: "2026-10-13"
  };
})();
