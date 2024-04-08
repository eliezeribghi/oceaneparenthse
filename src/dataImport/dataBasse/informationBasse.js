const informations = [
  {
    name: "Marée Basse",
    title: "Gîte 1 pièce",
    description: "Gîte rénové, capacité 4 personnes, de 37 m2. Salon, cuisine, 1 chambre (1 lit 160, 1 lit superposé 90), salle d'eau, parking. Terrasse privée, jardin partagé.<br/> <br>  Plage Clemenceau à 1,3 km.<br/> <br>  Commerces estivaux à 250 m. Inclus : chauffage, draps, linge de toilette. Proche forêt, sentiers de randonnées < 2 km.",
    roomComposition: [
      "1 lit 160x200",
      "1 lit superposé (2 x 90x200)"
    ],
    tarifs: [
      { label: "À partir de", amount: "60,00 €", isBold: true },
      { label: "Montant de la caution :", amount: "350,00 €", isBold: true },
      { label: "Forfait ménage :", amount: "40€ /séjour (en supplément)", isBold: true },
      { label: "Taxe de séjour", additionalInfo: "(en supplément)" }
    ],
  },
  // Ajoutez d'autres objets pour chaque description de logement
];

const myAccommodation = [{
  capacity: 4,
  rooms: 1,
  bathrooms: 1,
  beds: 2,
  squareMeter: 37,
  svgPaths: [
    { id: 1, path: "src/assets/public/guests.svg", title: "Capacity", text: "Hôtes" },
    { id: 2, path: "src/assets/public/bedrooms.svg", title: "Number of rooms", text: "Chambre" },
    { id: 3, path: "src/assets/public/shower.svg", title: "Number of bathrooms", text: "Douche " },
    { id: 4, path: "src/assets/public/beds.svg", title: "Number of beds", text: "Lits" },
    { id: 5, path: "src/assets/public/area.svg", title: "Surface", text: "m2" }
  ],
},
];
const tarifs = informations[0].tarifs;
const combinedData = [...informations, ...myAccommodation];

export { informations, myAccommodation, tarifs, combinedData };
