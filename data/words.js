// Shared word packs data used by both the game and the packs selector
const WORDS = {
  movies: {
    easy: [
      { word: "Inception", hint: "Dreams" },
      { word: "Avatar", hint: "Blue face" },
      { word: "Titanic", hint: "Ship" },
      { word: "Jaws", hint: "Teeth" },
      { word: "Gladiator", hint: "Fight" },
      { word: "The Matrix", hint: "Simulation" },
      { word: "Jurassic Park", hint: "Roar" }
    ],
    medium: [
      { word: "Parasite", hint: "Class conflict thriller" },
      { word: "Memento", hint: "Revenge with amnesia" },
      { word: "Interstellar", hint: "Space" },
      { word: "The Prestige", hint: "Rival magicians duel" },
      { word: "Blade Runner 2049", hint: "Replicant hunter in 2049" }
    ]
  },
  tvshows: {
    easy: [
      { word: "Game of Thrones", hint: "Medieval fantasy kingdoms" },
      { word: "Breaking Bad", hint: "Chemistry teacher crime" },
      { word: "The Office", hint: "Mockumentary workplace" },
      { word: "Friends", hint: "Six friends in NYC" },
      { word: "The Crown", hint: "British monarchy drama" },
      { word: "Stranger Things", hint: "Upside down mystery" }
    ],
    medium: [
      { word: "The Wire", hint: "Baltimore crime interconnection" },
      { word: "Mad Men", hint: "1960s advertising agency" },
      { word: "Succession", hint: "Media empire family battle" },
      { word: "True Detective", hint: "Flawed detectives' cases" },
      { word: "Mindhunter", hint: "FBI criminal profiling" }
    ]
  },
  celebrities: {
    easy: [
      { word: "Taylor Swift", hint: "Fast" },
      { word: "Elon Musk", hint: "Electric" },
      { word: "Oprah Winfrey", hint: "Opera" },
      { word: "Dwayne Johnson", hint: "Stone" },
      { word: "Beyoncé", hint: "Destiny's Child member" },
      { word: "Leonardo DiCaprio", hint: "Oscar-winning actor" }
    ],
    medium: [
      { word: "Timothée Chalamet", hint: "Young acclaimed actor" },
      { word: "Zendaya", hint: "Disney and HBO actress" },
      { word: "Oscar Isaac", hint: "Moon Knight actor" },
      { word: "Florence Pugh", hint: "Black Widow actress" },
      { word: "Andrew Garfield", hint: "Spider-Man actor" }
    ]
  },
  brands: {
    easy: [
      { word: "Apple", hint: "Gravity" },
      { word: "Nike", hint: "Swoosh athletic wear" },
      { word: "Coca-Cola", hint: "Red cola giant" },
      { word: "McDonald's", hint: "Golden arches fast food" },
      { word: "Disney", hint: "Mouse kingdom entertainment" },
      { word: "Amazon", hint: "River and shopping giant" },
      { word: "Netflix", hint: "Streaming red envelope" }
    ],
    medium: [
      { word: "Tesla", hint: "Motor" },
      { word: "Gucci", hint: "Italian luxury fashion" },
      { word: "Supreme", hint: "Streetwear supreme brand" },
      { word: "Rolex", hint: "Swiss luxury watches" },
      { word: "Hermès", hint: "French luxury leather goods" }
    ]
  },
  countries: {
    easy: [
      { word: "Japan", hint: "Land of rising sun" },
      { word: "Brazil", hint: "Samba and football nation" },
      { word: "Canada", hint: "Maple leaf frozen north" },
      { word: "Sweden", hint: "Meatballs" },
      { word: "Australia", hint: "Kangaroo island continent" },
      { word: "Egypt", hint: "Tomb" }
    ],
    medium: [
      { word: "Iceland", hint: "Fire and ice nation" },
      { word: "Vietnam", hint: "Pho and rice paddies" },
      { word: "Greece", hint: "Olive and island mythology" },
      { word: "Portugal", hint: "Port wine cork nation" },
      { word: "Thailand", hint: "Green Curry" }
    ]
  },
  animals: {
    easy: [
      { word: "Penguin", hint: "Tuxedo" },
      { word: "Giraffe", hint: "Neck" },
      { word: "Elephant", hint: "Trunk and memory" },
      { word: "Dolphin", hint: "Bottle" },
      { word: "Tiger", hint: "Stripy" },
      { word: "Panda", hint: "Bamboo" },
      { word: "Lion", hint: "Mane king of beasts" }
    ],
    medium: [
      { word: "Axolotl", hint: "Pink aquatic salamander" },
      { word: "Meerkat", hint: "Standing desert sentry" },
      { word: "Narwhal", hint: "Arctic whale with tusk" },
      { word: "Pangolin", hint: "Scaled insect eater" },
      { word: "Cassowary", hint: "Flightless rainbow bird" },
      { word: "Platypus", hint: "Egg-laying venomous mammal" },
      { word: "Okapi", hint: "Striped forest giraffe" },
      { word: "Fossa", hint: "Madagascar's apex predator" }
    ]
  },
  food: {
    easy: [
      { word: "Pizza", hint: "Cheesy Italian pie" },
      { word: "Sushi", hint: "Raw fish rice roll" },
      { word: "Burger", hint: "Patty between buns" },
      { word: "Pasta", hint: "Carb noodle dish" },
      { word: "Taco", hint: "Folded Mexican shell" },
      { word: "Donut", hint: "Fried circle with hole" },
      { word: "Steak", hint: "Grilled beef cut" }
    ],
    medium: [
      { word: "Baklava", hint: "Sweet pastry layers honey" },
      { word: "Ramen", hint: "Japanese noodle soup" },
      { word: "Samosa", hint: "Indian fried triangle" },
      { word: "Paella", hint: "Spanish rice festival dish" },
      { word: "Kimchi", hint: "Spicy fermented vegetables" },
      { word: "Pierogi", hint: "Polish stuffed dumplings" },
      { word: "Ceviche", hint: "Peruvian citrus fish" }
    ]
  },
  objects: {
    easy: [
      { word: "Telescope", hint: "Star gazing instrument" },
      { word: "Clock", hint: "Time telling device" },
      { word: "Lamp", hint: "Light source furniture" },
      { word: "Guitar", hint: "String musical instrument" },
      { word: "Bicycle", hint: "Two wheel pedal vehicle" },
      { word: "Camera", hint: "Photo capturing device" }
    ],
    medium: [
      { word: "Sundial", hint: "Shadow time ancient tracker" },
      { word: "Compass", hint: "Navigation direction pointer" },
      { word: "Hourglass", hint: "Sand flowing time marker" },
      { word: "Lantern", hint: "Portable light container" },
      { word: "Astrolabe", hint: "Medieval astronomy tool" },
      { word: "Phonograph", hint: "Edison's sound recorder" },
      { word: "Typewriter", hint: "Mechanical writing machine" },
      { word: "Abacus", hint: "Ancient counting frame" }
    ]
  },
  sports: {
    easy: [
      { word: "Basketball", hint: "Hoop and dribble ball" },
      { word: "Football", hint: "Touchdown gridiron" },
      { word: "Tennis", hint: "Racket and net sport" },
      { word: "Swimming", hint: "Water pool movement" },
      { word: "Skiing", hint: "Snow mountain descent" },
      { word: "Surfing", hint: "Wave riding board" }
    ],
    medium: [
      { word: "Archery", hint: "Bow and arrow target" },
      { word: "Curling", hint: "Ice stone sliding" },
      { word: "Fencing", hint: "Sword thrust sport" },
      { word: "Rowing", hint: "Oar and boat water" },
      { word: "Biathlon", hint: "Ski and shoot combo" },
      { word: "Kabaddi", hint: "South Asian tag raid" }
    ]
  },
  places: {
    easy: [
      { word: "Beach", hint: "Sand and ocean shore" },
      { word: "Mountain", hint: "High peak terrain" },
      { word: "Park", hint: "Green recreational space" },
      { word: "Library", hint: "Book knowledge building" },
      { word: "Airport", hint: "Plane takeoff hub" },
      { word: "Stadium", hint: "Large sporting venue" }
    ],
    medium: [
      { word: "Bazaar", hint: "Middle Eastern market" },
      { word: "Harbor", hint: "Coastal boat anchorage" },
      { word: "Temple", hint: "Religious worship place" },
      { word: "Vineyard", hint: "Wine grape farm" },
      { word: "Catacombs", hint: "Underground burial tunnels" },
      { word: "Observatory", hint: "Star viewing dome" },
      { word: "Colosseum", hint: "Roman arena ruins" },
      { word: "Monastery", hint: "Bald" }
    ]
  }
};