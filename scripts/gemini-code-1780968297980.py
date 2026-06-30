#!/usr/bin/env python3
"""
FUTBIN - Scraper de fotos del Mundial 2026 (VERSIÓN FINAL CORREGIDA)
Resuelve completamente el problema de "no hace click" y "no encuentra jugadores".

ENFOQUE NUEVO:
- Usa la URL de búsqueda de Futbin con el formato correcto para EA FC 26
- Extrae el player_id del HTML de resultados
- Navega DIRECTAMENTE a la página del jugador: /26/player/ID/nombre
- Extrae la imagen de la página del jugador

pip install playwright requests beautifulsoup4 tqdm unidecode
python -m playwright install chromium
"""

import re, sys, time, json, argparse, requests, traceback
from pathlib import Path
from urllib.parse import quote, unquote

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("pip install playwright && python -m playwright install chromium"); sys.exit(1)
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("pip install beautifulsoup4"); sys.exit(1)
try:
    from tqdm import tqdm
except ImportError:
    class tqdm:
        def __init__(self, iterable=None, **kw):
            self.it=iterable or []; self._n=0; self.desc=kw.get("desc",""); self.total=kw.get("total")
        def __iter__(self):
            for x in self.it:
                self._n+=1
                print(f"\r  {self.desc}: {self._n}"+(f"/{self.total}" if self.total else ""),end="",flush=True)
                yield x
            print()
        def __enter__(self): return self
        def __exit__(self,*a): print()
        def update(self,n=1): self._n+=n; print(f"\r  {self.desc}: {self._n}",end="",flush=True)
        def set_postfix_str(self,s): pass
        def close(self): print()

# Intentar importar unidecode para normalizar búsquedas difíciles
try:
    from unidecode import unidecode
except ImportError:
    def unidecode(s): return s  # Fallback si no está instalado

# ─────────────────────────────────────────────────────────────────────────────
#  PLANTELES OFICIALES CORREGIDOS — Mundial 2026
# ─────────────────────────────────────────────────────────────────────────────

WC2026_SQUADS = {
    "Republica Checa": {
        "nation_id": 12,
        "players": [
            "Lukáš Horníček", "Štěpán Chaloupek", "Robin Hranáč", "Ladislav Krejčí",
            "Jaroslav Zelený", "Tomáš Souček", "Vladimír Darida",
            "Vladimír Coufal", "Lukáš Provod", "Michal Sadílek", "Patrik Schick",
            "Jan Koutný", "Jindřich Staněk", "David Douděra", "Tomáš Holeš",
            "David Jurásek", "David Zima", "Lukáš Červ", "Alexandr Sojka",
            "Hugo Sochůrek", "Adam Hložek", "Tomáš Chorý", "Mojmír Chytil",
            "Jan Kuchta", "Matěj Vydra", "Denis Višinský"
        ]
    },
    "Mexico": {
        "nation_id": 83,
        "players": [
            "Rangel", "Jorge Sánchez", "César Montes", "Johan Vásquez",
            "Jesús Gallardo", "Orbelín Pineda", "Edson Álvarez", "Álvaro Fidalgo",
            "Alexis Vega", "Raúl Jiménez", "Julián Quiñones",
            "Carlos Acevedo", "Guillermo Ochoa", "Israel Reyes", "Mateo Chávez",
            "Gilberto Mora", "Brian Gutiérrez", "Obed Vargas", "César Huerta",
            "Luis Chávez", "Erik Lira", "Roberto Alvarado", "Armando González",
            "Santiago Giménez", "Guillermo Martínez", "Luis Romo"
        ]
    },
    "Sudafrica": {
        "nation_id": 140,
        "players": [
            "Ronwen Williams", "Khuliso Mudau", "Nkosinathi Sibisi", "Khulumani Ndamane",
            "Aubrey Modiba", "Yaya Sithole", "Teboho Mokoena", "Oswin Appollis",
            "Themba Zwane", "Relebohile Mofokeng", "Lyle Foster",
            "Ricardo Goss", "Sipho Chaine", "Ime Okon", "Samukelo Kabini",
            "Thabang Matuludi", "Olwethu Makhanya", "Kamogelo Sebelebele", "Bradley Cross",
            "Mbekezeli Mbokazi", "Thalente Mbatha", "Jayden Adams", "Iqraam Rayners",
            "Tshepang Moremi", "Evidence Makgopa", "Thapelo Maseko"
        ]
    },
    "Corea del Sur": {
        "nation_id": 167,
        "players": [
            "Kim Seung Gyu", "Kim Min Jae", "Lee Han Beom", "Seol Young Woo",
            "Lee Tae Seok", "Hwang In Beom", "Jens Castrop", "Lee Kang In",
            "Lee Jae Sung", "Bae Jun Ho", "Son",
            "Jo Hyun Woo", "Song Bum Keun", "Jo Yu Min", "Kim Tae Hyun",
            "Park Jin Seop", "Lee Ki Hyeok", "Cho Wi Je", "Kim Moon Hwan",
            "Yang Hyun Jun", "Paik Seung Ho", "Kim Jin Kyu", "Um Ji Sung",
            "Hwang Hee Chan", "Lee Dong Gyeong", "Oh Hyeon Kyu"
        ]
    },
    "Bosnia": {
        "nation_id": 8,
        "players": [
            "Nikola Vasilj", "Amar Dedić", "Nikola Katić", "Tarik Muharemović",
            "Sead Kolašinac", "Esmir Bajraktarević", "Ivan Šunjić", "Benjamin Tahirović",
            "Amar Memić", "Ermedin Demirović", "Edin Džeko",
            "Martin Zlomislić", "Osman Hadžikić", "Nihad Mujakić", "Dennis Hadžikadunić",
            "Stjepan Radeljić", "Nidal Čelik", "Amir Hadžiahmetović", "Ivan Bašić",
            "Dženis Burnić", "Ermin Mahmić", "Kerim Alajbegović", "Jovo Lukić",
            "Samed Baždar", "Haris Tabaković", "Haris Hajradinović"
        ]
    },
    "Canada": {
        "nation_id": 70,
        "players": [
            "Maxime Crépeau", "Niko Sigur", "Moïse Bombito", "Alfie Jones",
            "Richie Laryea", "Tajon Buchanan", "Ismaël Koné", "Stephen Eustáquio",
            "Alphonso Davies", "Tani Oluwaseyi", "Jonathan David",
            "Dayne St. Clair", "Owen Goodman", "Alistair Johnston", "Luc de Fougerolles",
            "Joel Waterman", "Mathieu Choinière", "Derek Cornelius", "Jacob Shaffelburg",
            "Liam Millar", "Ali Ahmed", "Jonathan Osorio", "Promise David",
            "Nathan Saliba", "Kamal Miller", "Lucas Cavallini"
        ]
    },
    "Qatar": {
        "nation_id": 182,
        "players": [
            "Meshaal Barsham", "Ayoub Al-Alawi", "Boualem Khoukhi", "Pedro Miguel",
            "Homam Al-Amin", "Karim Boudiaf", "Ahmed Fathi", "Issa Laye",
            "Edmilson Junior", "Almoez Ali", "Akram Afif",
            "Salah Zakaria", "Mahmoud Abunada", "Sultan Al Brake", "Al-Hashmi Al-Hussain",
            "Jassim Gaber", "Assim Madibo", "Abdulaziz Hatem", "Mohammed Mannai",
            "Ahmed Al-Ganehi", "Ahmed Alaa", "Hassan Al-Haydos", "Mohammed Muntari",
            "Yusuf Abdurisag", "Tahsin Mohammed", "Jassem Al-Owais"
        ]
    },
    "Suiza": {
        "nation_id": 47,
        "players": [
            "Gregor Kobel", "Silvan Widmer", "Manuel Akanji", "Nico Elvedi",
            "Ricardo Rodríguez", "Remo Freuler", "Granit Xhaka", "Fabian Rieder",
            "Dan Ndoye", "Breel Embolo", "Ruben Vargas",
            "Yvon Mvogo", "Marvin Keller", "Aurèle Amenda", "Eray Cömert",
            "Luca Jaquez", "Johan Manzambi", "Djibril Sow", "Christian Fassnacht",
            "Michel Aebischer", "Denis Zakaria", "Ardon Jashari", "Noah Okafor",
            "Zeki Amdouni", "Cédric Itten", "Leonidas Stergiou"
        ]
    },
    "Brasil": {
        "nation_id": 54,
        "players": [
            "Alisson", "Wesley", "Marquinhos", "Gabriel",
            "Alex Sandro", "Luiz Henrique", "Casemiro", "Bruno Guimarães",
            "Raphinha", "Vinícius Jr.", "Matheus Cunha",
            "Weverton", "Ederson", "Bremer", "Danilo",
            "Léo Pereira", "Ibañez", "Fabinho", "Danilo",
            "Gabriel Martinelli", "Endrick", "Igor Thiago", "Rayan",
            "Estêvão", "Neymar Jr", "João Pedro"
        ]
    },
    "Haiti": {
        "nation_id": 80,
        "players": [
            "Johny Placide", "Carlens Arcus", "Ricardo Adé", "Jean-Kévin Duverne",
            "Martin Expérience", "Louicius Deedson", "Jean-Ricner Bellegarde", "Woodensky Pierre",
            "Wilson Isidor", "Duckens Nazon", "Ruben Providence",
            "Alexandre Pierre", "Josué Duverger", "Duke Lacroix", "Wilguens Paugain",
            "Hannes Delcroix", "Keeto Thermoncy", "Leverton Pierre", "Danley Jean Jacques",
            "Carl Sainte", "Dominique Simon", "Frantzdy Pierrot", "Derrick Etienne",
            "Josué Casimir", "Yassin Fortuné", "Lenny Joseph"
        ]
    },
    "Marruecos": {
        "nation_id": 129,
        "players": [
            "Bounou", "Achraf Hakimi", "Issa Diop", "Nayef Aguerd",
            "Eliesse Ben Seghir", "Azzedine Ounahi", "Neil El Aynaoui", "Brahim",
            "Ismael Saibari", "Amine Adli", "Ayoub El Kaabi",
            "El Mehdi Benabid", "Ahmed Reda Tagnaouti", "Jawad El Yamiq", "Sofyan Amrabat",
            "Selim Amallah", "Abde", "Hakim Ziyech", "Soufiane Rahimi",
            "Abderahmane Hilmand", "Abdelhamid Sabiri", "Youssef En-Nesyri", "Ilias Akhomach",
            "Chadi Riad", "Yunis Abdelhamid", "Oussama El Azzouzi"
        ]
    },
    "Escocia": {
        "nation_id": 42,
        "players": [
            "Craig Gordon", "Aaron Hickey", "Grant Hanley", "Scott McKenna",
            "Andy Robertson", "Lewis Ferguson", "Ben Doak", "Ryan Christie",
            "Scott McTominay", "John McGinn", "Che Adams",
            "Angus Gunn", "Liam Kelly", "Jack Hendry", "Dom Hyam",
            "Nathan Patterson", "Anthony Ralston", "John Souttar", "Kieran Tierney",
            "Findlay Curtis", "Billy Gilmour", "Kenny McLean", "Lyndon Dykes",
            "George Hirst", "Lawrence Shankland", "Ross Stewart"
        ]
    },
    "Australia": {
        "nation_id": 195,
        "players": [
            "Mathew Ryan", "Jacob Italiano", "Milos Degenek", "Harry Souttar",
            "Alessandro Circati", "Jordan Bos", "Connor Metcalfe", "Cameron Devlin",
            "Aiden O'Neill", "Nestory Irankunda", "Mohamed Touré",
            "Paul Izzo", "Patrick Beach", "Aziz Behich", "Lucas Herrington",
            "Cameron Burgess", "Kai Trewin", "Jason Geria", "Paul Okon-Engstler",
            "Ajdin Hrustic", "Mathew Leckie", "Nishan Velupillay", "Cristian Volpato",
            "Awer Mabil", "Tete Yengi", "Craig Goodwin"
        ]
    },
    "Paraguay": {
        "nation_id": 58,
        "players": [
            "Santiago Rojas", "Fabián Balbuena", "Gustavo Gómez", "Omar Alderete",
            "Júnior Alonso", "Diego Gómez", "Mathías Villasanti", "Damián Bobadilla",
            "Miguel Almirón", "Julio Enciso", "Antonio Galeano",
            "Carlos Coronel", "Gatito Fernández", "Blas Riveros", "Andrés Cubas",
            "Hernesto Caballero", "Juan Escobar", "Hugo Quintana", "Antonio Sanabria",
            "Bareiro", "Ángel Romero", "Óscar Romero", "Alex Arce",
            "Enso González", "Matías Rojas", "Fabrizio Peralta"
        ]
    },
    "Turquia": {
        "nation_id": 48,
        "players": [
            "Uğurcan Çakır", "Merih Demiral", "Ozan Kabak", "Abdülkerim Bardakcı",
            "Zeki Çelik", "Hakan Çalhanoğlu", "Orkun Kökçü", "Ferdi Kadıoğlu",
            "Arda Güler", "Kenan Yıldız", "Kerem Aktürkoğlu",
            "Mert Günok", "Altay Bayındır", "Mert Müldür", "Kaan Ayhan",
            "Okay Yokuşlu", "Salih Özcan", "Yunus Akgün", "Yusuf Yazıcı",
            "Cengiz Ünder", "İrfan Can Kahveci", "Semih Kılıçsoy", "Umut Nayir",
            "Bertuğ Yıldırım", "Enes Ünal", "Yunus Akgün"
        ]
    },
    "Estados Unidos": {
        "nation_id": 95,
        "players": [
            "Matt Freese", "Alex Freeman", "Chris Richards", "Auston Trusty",
            "Antonee Robinson", "Weston McKennie", "Sebastian Berhalter", "Tyler Adams",
            "Tim Weah", "Folarin Balogun", "Christian Pulisic",
            "Matt Turner", "Chris Brady", "Sergiño Dest", "Mark McKenzie",
            "Tim Ream", "Miles Robinson", "Joe Scally", "Max Arfsten",
            "Cristian Roldan", "Malik Tillman", "Brenden Aaronson", "Gio Reyna",
            "Alejandro Zendejas", "Ricardo Pepi", "Haji Wright"
        ]
    },
    "Curacao": {
        "nation_id": 85,
        "players": [
            "Eloy Room", "Shurandy Sambo", "Roshon van Eijma", "Armando Obispo",
            "Sherel Floranus", "Juninho Bacuna", "Livano Comenencia", "Leandro Bacuna",
            "Tahith Chong", "Jürgen Locadia", "Kenji Gorré",
            "Tyrick Bodak", "Trevor Doornbusch", "Riechedly Bazoer", "Joshua Brenet",
            "Deveron Fonville", "Jurien Gaari", "Kevin Felida", "Ar'jany Martha",
            "Tyrese Noslin", "Godfried Roemeratoe", "Jeremy Antonisse", "Sontje Hansen",
            "Gervane Kastaneer", "Brandley Kuwas", "Jearl Margaritha"
        ]
    },
    "Ecuador": {
        "nation_id": 57,
        "players": [
            "Hernán Galíndez", "Ángelo Preciado", "Joel Ordóñez", "Willian Pacho",
            "Piero Hincapié", "Pedro Vite", "Moisés Caicedo", "Denil Castillo",
            "John Yeboah", "Enner Valencia", "Nilson Angulo",
            "Moisés Ramírez", "Gonzalo Valle", "Yaimar Medina", "Jackson Porozo",
            "Alan Minda", "Jordy Alcívar", "Alan Franco", "Kendry Páez",
            "Kevin Rodríguez", "Anthony Valencia", "Jordy Caicedo", "Jeremy Arévalo",
            "Gonzalo Plata", "José Cifuentes", "Romario Ibarra"
        ]
    },
    "Alemania": {
        "nation_id": 21,
        "players": [
            "Manuel Neuer", "Joshua Kimmich", "Jonathan Tah", "Nico Schlotterbeck",
            "David Raum", "Aleksandar Pavlović", "Leon Goretzka", "Leroy Sané",
            "Jamal Musiala", "Florian Wirtz", "Kai Havertz",
            "Oliver Baumann", "Alexander Nübel", "Waldemar Anton", "Nathaniel Brown",
            "Malick Thiaw", "Pascal Groß", "Angelo Stiller", "Lennart Karl",
            "Nadiem Amiri", "Maximilian Beier", "Deniz Undav", "Nick Woltemade",
            "Jamie Leweling", "Chris Führich", "Jonathan Burkardt"
        ]
    },
    "Costa de Marfil": {
        "nation_id": 108,
        "players": [
            "Yahia Fofana", "Guéla Doué", "Odilon Kossounou", "Evan Ndicka",
            "Ghislain Konan", "Franck Kessié", "Ibrahim Sangaré", "Christ Inao Oulai",
            "Nicolas Pépé", "Evann Guessand", "Yan Diomandé",
            "Mohamed Koné", "Alban Lafont", "Emmanuel Agbadou", "Clément Akpa",
            "Ousmane Diomande", "Wilfried Singo", "Seko Fofana", "Parfait Guiagon",
            "Jean Michaël Seri", "Simon Adingra", "Ange-Yoan Bonny", "Amad Diallo",
            "Oumar Diakité", "Bazoumana Touré", "Elye Wahi"
        ]
    },
    "Japon": {
        "nation_id": 163,
        "players": [
            "Zion Suzuki", "Takehiro Tomiyasu", "Shogo Taniguchi", "Ko Itakura",
            "Ritsu Doan", "Wataru Endo", "Ao Tanaka", "Keito Nakamura",
            "Takefusa Kubo", "Junya Ito", "Ayase Ueda",
            "Keisuke Osako", "Tomoki Hayakawa", "Yuto Nagatomo", "Tsuyoshi Watanabe",
            "Hiroki Ito", "Ayumu Seko", "Yukinari Sugawara", "Junnosuke Suzuki",
            "Daichi Kamada", "Kaishu Sano", "Yuito Suzuki", "Koki Ogawa",
            "Daizen Maeda", "Kento Shiogai", "Keisuke Goto"
        ]
    },
    "Paises Bajos": {
        "nation_id": 34,
        "players": [
            "Bart Verbruggen", "Denzel Dumfries", "Virgil van Dijk", "Nathan Aké",
            "Micky van de Ven", "Frenkie de Jong", "Ryan Gravenberch", "Donyell Malen",
            "Tijjani Reijnders", "Cody Gakpo", "Memphis",
            "Mark Flekken", "Robin Roefs", "Jorrel Hato", "Jurriën Timber",
            "Jan Paul van Hecke", "Marten de Roon", "Teun Koopmeiners", "Guus Til",
            "Quinten Timber", "Mats Wieffer", "Justin Kluivert", "Noa Lang",
            "Wout Weghorst", "Brian Brobbey", "Crysencio Summerville"
        ]
    },
    "Suecia": {
        "nation_id": 46,
        "players": [
            "Kristoffer Nordfeldt", "Carl Starfelt", "Gustaf Lagerbielke", "Victor Lindelöf",
            "Daniel Svensson", "Jesper Karlström", "Yasin Ayari", "Gabriel Gudmundsson",
            "Benjamin Nygren", "Anthony Elanga", "Viktor Gyökeres",
            "Viktor Johansson", "Jacob Widell Zetterström", "Hjalmar Ekdal", "Emil Holm",
            "Erik Smith", "Elliot Stroud", "Taha Ali", "Ken Sema",
            "Mattias Svanberg", "Besfort Zeneli", "Alexander Bernhardsson", "Alexander Isak",
            "Gustaf Nilsson", "Oscar Bobb", "Jörgen Strand Larsen"
        ]
    },
    "Tunez": {
        "nation_id": 145,
        "players": [
            "Aymen Dahmen", "Yan Valery", "Dylan Bronn", "Montassar Talbi",
            "Ali Abdi", "Ismaël Gharbi", "Ellyes Skhiri", "Hannibal Mejbri",
            "Elias Achouri", "Hazem Mastouri", "Sebastian Tounekti",
            "Sabri Ben Hessen", "Abdelmouhib Chamakh", "Moutaz Neffati", "Raed Chikhaoui",
            "Adam Arous", "Mohamed Amine Ben Hamida", "Anis Ben Slimane", "Hadj Mahmoud",
            "Rani Khedira", "Mortadha Ben Ouanes", "Firas Chaouat", "Khalil Ayari",
            "Rayan Elloumi", "Hazem Mastouri", "Sebastian Tounekti"
        ]
    },
    "Belgica": {
        "nation_id": 7,
        "players": [
            "Thibaut Courtois", "Timothy Castagne", "Zeno Debast", "Arthur Theate",
            "Maxim De Cuyper", "Youri Tielemans", "Amadou Onana", "Jérémy Doku",
            "Kevin De Bruyne", "Leandro Trossard", "Charles De Ketelaere",
            "Senne Lammens", "Mike Penders", "Koni De Winter", "Brandon Mechele",
            "Thomas Meunier", "Nathan Ngoy", "Joaquin Seys", "Nicolas Raskin",
            "Hans Vanaken", "Axel Witsel", "Matias Fernandez-Pardo", "Romelu Lukaku",
            "Dodi Lukebakio", "Diego Moreira", "Alexis Saelemaekers"
        ]
    },
    "Egipto": {
        "nation_id": 111,
        "players": [
            "Mohamed El Shenawy", "Yasser Ibrahim", "Hossam Abdelmaguid", "Ramy Rabia",
            "Mohamed Hany", "Marwan Attia", "Mohanad Lasheen", "Ahmed Fatouh",
            "Emam Ashour", "Salah", "Omar Marmoush",
            "Mostafa Shobeir", "El Mahdy Soliman", "Tarek Alaa", "Karim Hafez",
            "Nabil Emad", "Mahmoud Saber", "Zizo", "Mostafa Ziko",
            "Trezeguet", "Ibrahim Adel", "Haissem Hassan", "Hamza Abdelkarim",
            "Mostafa Fathi", "Ahmed Hegazi", "Mohamed Abdelmonem"
        ]
    },
    "Iran": {
        "nation_id": 161,
        "players": [
            "Alireza Beiranvand", "Aria Yousefi", "Hossein Kanaani", "Shoja Khalilzadeh",
            "Milad Mohammadi", "Saeid Ezatolahi", "Saman Ghoddos", "Alireza Jahanbakhsh",
            "Mehdi Ghaedi", "Mohammad Mohebi", "Mehdi Taremi",
            "Hossein Hosseini", "Payam Niazmand", "Danial Eiri", "Ehsan Hajsafi",
            "Saleh Hardani", "Ali Nemati", "Omid Noorafkan", "Ramin Rezaeian",
            "Rouzbeh Cheshmi", "Mohammad Ghorbani", "Amir Mohammad Razzaghinia", "Mehdi Torabi",
            "Ali Alipour", "Dennis Dargahi", "Amirhossein Hosseinzadeh"
        ]
    },
    "Nueva Zelanda": {
        "nation_id": 198,
        "players": [
            "Max Crocombe", "Tim Payne", "Tyler Bindon", "Michael Boxall",
            "Liberato Cacace", "Marko Stamenic", "Joe Bell", "Callum McCowatt",
            "Sarpreet Singh", "Matt Garbett", "Chris Wood",
            "Alex Paulsen", "Michael Woud", "Francis De Vries", "Nando Pijnaker",
            "Finn Surman", "Callan Elliot", "Tommy Smith", "Alex Rufer",
            "Ryan Thomas", "Eli Just", "Kosta Barbarouses", "Ben Waine",
            "Ben Old", "Jesse Randall", "Lachlan Bayliss"
        ]
    },
    "Cabo Verde": {
        "nation_id": 104,
        "players": [
            "Vozinha", "Steven Moreira", "Roberto Lopes", "Diney Borges",
            "Sidny Cabral", "Laros Duarte", "Deroy Duarte", "Garry Rodrigues",
            "Jamiro Monteiro", "Jovane Cabral", "Dailon Livramento",
            "Carlos Dos Santos", "Marcio Rosa", "Stopira", "João Paulo",
            "Wagner Pina", "Kelvin Pires", "João Paulo Fernandes", "Kevin Pina",
            "Telmo Arcanjo", "Yannick Semedo", "Gilson Benchimol", "Nuno Da Costa",
            "Ryan Mendes", "Willy Semedo", "Lisandro Semedo"
        ]
    },
    "Arabia Saudita": {
        "nation_id": 183,
        "players": [
            "Nawaf Al Aqidi", "Nawaf Boushal", "Hassan Tambakti", "Abdulelah Al Amri",
            "Moteb Al Harbi", "Mohammed Kanno", "Abdullah Al Khaibari", "Nasser Al Dawsari",
            "Salem Al Dawsari", "Firas Al Buraikan", "Ayman Yahya",
            "Mohammed Al Owais", "Ahmed Al Kassar", "Jehad Thikri", "Ali Lajami",
            "Hassan Kadesh", "Saud Abdulhamid", "Mohammed Abu Al Shamat", "Ali Majrashi",
            "Sultan Al-Ghannam", "Ziyad Al Johani", "Musab Al Juwayr", "Alaa Al Hajji",
            "Khalid Al Ghannam", "Saleh Al Shehri", "Abdullah Al Hamdan"
        ]
    },
    "Espana": {
        "nation_id": 45,
        "players": [
            "Unai Simón", "Marcos Llorente", "Pau Cubarsí", "Aymeric Laporte",
            "Marc Cucurella", "Pedri", "Rodri", "Fabian",
            "Lamine Yamal", "Mikel Oyarzabal", "Nico Williams",
            "David Raya", "Joan García", "Pedro Porro", "Eric García",
            "Alejandro Grimaldo", "Martin Zubimendi", "Gavi", "Álex Baena",
            "Ferran Torres", "Borja Iglesias", "Dani Olmo", "Víctor Muñoz",
            "Yeremy Pino", "Mikel Merino", "José Luis Gayà"
        ]
    },
    "Uruguay": {
        "nation_id": 60,
        "players": [
            "Sergio Rochet", "Guillermo Varela", "José María Giménez", "Ronald Araújo",
            "Mathías Olivera", "Federico Valverde", "Manuel Ugarte", "Rodrigo Bentancur",
            "Agustín Canobbio", "Darwin Núñez", "Brian Rodríguez",
            "Fernando Muslera", "Santiago Mele", "Santiago Bueno", "Sebastián Cáceres",
            "Matías Viña", "Joaquín Piquerez", "Juan Manuel Sanabria", "Rodrigo Zalazar",
            "Giorgian De Arrascaeta", "Nicolás De La Cruz", "Maximiliano Araújo",
            "Federico Viñas", "Rodrigo Aguirre", "Lucas Olaza", "Facundo Pellistri"
        ]
    },
    "Francia": {
        "nation_id": 18,
        "players": [
            "Mike Maignan", "Jules Koundé", "William Saliba", "Dayot Upamecano",
            "Lucas Hernández", "Adrien Rabiot", "Aurélien Tchouaméni", "Ousmane Dembélé",
            "Michael Olise", "Désiré Doué", "Kylian Mbappé",
            "Robin Risser", "Brice Samba", "Malo Gusto", "Ibrahima Konaté",
            "Théo Hernández", "Maxence Lacroix", "Warren Zaïre-Emery", "Manu Koné",
            "Bradley Barcola", "Rayan Cherki", "Marcus Thuram", "Maghnes Akliouche",
            "Jean-Philippe Mateta", "Randal Kolo Muani", "Eduardo Camavinga"
        ]
    },
    "Irak": {
        "nation_id": 162,
        "players": [
            "Jalal Hassan", "Hussein Ali", "Rebin Sulaka", "Zaid Tahseen",
            "Merchas Doski", "Amir Al-Ammari", "Ibrahim Bayesh", "Ali Jasim",
            "Zidane Iqbal", "Youssef Amyn", "Aymen Hussein",
            "Fahad Talib", "Ahmed Basil", "Manaf Younis", "Ahmed Yahya",
            "Zaid Ismail", "Frans Putros", "Mustafa Saadoon", "Kevin Yakob",
            "Aimar Sher", "Ahmed Qasim", "Ali Al-Hamadi", "Ali Yousef",
            "Mohanad Ali", "Saad Abdul-Amir", "Humam Tariq"
        ]
    },
    "Noruega": {
        "nation_id": 36,
        "players": [
            "Ørjan Nyland", "Julian Ryerson", "Torbjørn Heggem", "Leo Østigård",
            "David Møller Wolfe", "Kristian Thorstvedt", "Patrick Berg", "Sander Berge",
            "Alexander Sørloth", "Erling Haaland", "Antonio Nusa",
            "Egil Selvik", "Sander Tangvik", "Kristoffer Ajer", "Fredrik André Bjørkan",
            "Henrik Falchener", "Sondre Langås", "Martin Ødegaard", "Morten Thorsby",
            "Thelo Aasgaard", "Andreas Schjelderup", "Jens Petter Hauge", "Fredrik Aursnes",
            "Oscar Bobb", "Jörgen Strand Larsen", "Sander Tangvik"
        ]
    },
    "Senegal": {
        "nation_id": 136,
        "players": [
            "Édouard Mendy", "Krépin Diatta", "Kalidou Koulibaly", "Moussa Niakhate",
            "Ismail Jakobs", "Idrissa Gana Gueye", "Pape Gueye", "Ismaïla Sarr",
            "Iliman Ndiaye", "Sadio Mané", "Nicolas Jackson",
            "Mory Diaw", "Yehvann Diouf", "Antoine Mendy", "El Hadji Malick Diouf",
            "Mamadou Sarr", "Abdoulaye Seck", "Lamine Camara", "Habib Diarra",
            "Pathé Ciss", "Pape Matar Sarr", "Bara Sapoko Ndiaye", "Assane Diao",
            "Ibrahim Mbaye", "Bamba Dieng", "Chérif Ndiaye"
        ]
    },
    "Argelia": {
        "nation_id": 133,
        "players": [
            "Luca Zidane", "Rafik Belghali", "Zinedine Belaïd", "Ramy Bensebaini",
            "Rayan Aït Nouri", "Ramiz Zerrouki", "Hicham Boudaoui", "Riyad Mahrez",
            "Houssem Aouar", "Farès Chaïbi", "Amine Gouiri",
            "Oussama Benbot", "Melvin Masstil", "Achraf Abada", "Samir Chergui",
            "Jaouen Hadjam", "Aïssa Mandi", "Mohamed Amine Tougai", "Nabil Bentaleb",
            "Ibrahim Maza", "Yassine Titraoui", "Mohamed Amine Amoura", "Nadir Benbouali",
            "Adil Boulbina", "Farès Ghedjemis", "Anis Hadj Moussa"
        ]
    },
    "Argentina": {
        "nation_id": 52,
        "players": [
            "Emiliano Martínez", "Nahuel Molina", "Nicolás Otamendi", "Cristian Romero",
            "Nicolás Tagliafico", "Alexis Mac Allister", "Leandro Paredes", "Enzo Fernández",
            "Lionel Messi", "Julián Álvarez", "Thiago Almada",
            "Gerónimo Rulli", "Juan Musso", "Gonzalo Montiel", "Lisandro Martínez",
            "Leonardo Balerdi", "Facundo Medina", "Valentín Barco", "Rodrigo De Paul",
            "Exequiel Palacios", "Giovani Lo Celso", "Nico Paz", "Nicolás González",
            "Giuliano Simeone", "Lautaro Martínez", "José Manuel López"
        ]
    },
    "Austria": {
        "nation_id": 4,
        "players": [
            "Patrick Pentz", "Konrad Laimer", "Philipp Lienhart", "David Alaba",
            "Phillipp Mwene", "Xaver Schlager", "Nicolas Seiwald", "Patrick Wimmer",
            "Christoph Baumgartner", "Marcel Sabitzer", "Marko Arnautović",
            "Heinz Lindner", "Niklas Hedl", "Maximilian Wöber", "Kevin Danso",
            "Flavius Daniliuc", "Gernot Trauner", "Marco Friedl", "Romano Schmid",
            "Florian Grillitsch", "Alexander Prass", "Muhammed Cham", "Louis Schaub",
            "Michael Gregoritsch", "Bendegúz Bolla", "Tobias Hedl"
        ]
    },
    "Jordania": {
        "nation_id": 164,
        "players": [
            "Yazid Abu Layla", "Anas Bani Yaseen", "Abdullah Nasib", "Yazan Al-Arab",
            "Ihsan Haddad", "Noor Al-Rawabdeh", "Nizar Al-Rashdan", "Mohammad Abu Taha",
            "Musa Al-Taamari", "Ali Olwan", "Mahmoud Al-Mardi",
            "Ahmad Al-Juaidi", "Abdullah Al-Fakhouri", "Mohammad Abu Hashish", "Samer Jondi",
            "Hasan Abdel-Fattah", "Yazan Al-Naimat", "Hamza Al-Dardour", "Baha' Faisal",
            "Yazan Ahmad", "Owais Aws", "Sofyan Barakat", "Mohammad Abu Zrayq",
            "Ahmad Saleh", "Odai Al-Saify", "Khaled Al-Rosan"
        ]
    },
    "Colombia": {
        "nation_id": 56,
        "players": [
            "Álvaro Montero", "Daniel Muñoz", "Davinson Sánchez", "Yerry Mina",
            "Johan Mojica", "Jefferson Lerma", "Richard Ríos", "Jhon Arias",
            "James Rodríguez", "Luis Díaz", "Luis Suárez",
            "David Ospina", "Camilo Vargas", "Carlos Cuesta", "Jhon Lucumí",
            "Deiver Machado", "Mateus Uribe", "Juan Fernando Quintero", "Rafael Santos Borré",
            "Miguel Borja", "Jhon Córdoba", "Luis Sinisterra", "Jhon Durán",
            "Daniel Cataño", "Jorge Carrascal", "Yerson Candelo"
        ]
    },
    "Congo DR": {
        "nation_id": 110,
        "players": [
            "Lionel Mpasi", "Aaron Wan-Bissaka", "Chancel Mbemba", "Axel Tuanzebe",
            "Arthur Masuaku", "Charles Pickel", "Samuel Moutoussamy", "Théo Bongonda",
            "Gaël Kakuta", "Yoane Wissa", "Cédric Bakambu",
            "Timothy Fayulu", "Mike Epolo", "Gédéon Kalulu", "Joris Kayembe",
            "Steve Kapuadi", "Rocky Bushiri", "Dylan Batubinsika", "Edo Kayembe",
            "Ngal'ayel Mukau", "Nathanaël Mbuku", "Brian Cipenga", "Meschack Elia",
            "Fiston Mayele", "Simon Banza", "Paul-José M'Poku"
        ]
    },
    "Portugal": {
        "nation_id": 38,
        "players": [
            "Diogo Costa", "João Cancelo", "Rúben Dias", "Gonçalo Inácio",
            "Nuno Mendes", "João Neves", "Vitinha", "Bruno Fernandes",
            "Bernardo Silva", "Cristiano Ronaldo", "João Félix",
            "José Sá", "Rui Silva", "Diogo Dalot", "Renato Veiga",
            "Matheus Nunes", "António Silva", "Rúben Neves", "Samu",
            "Rafael Leão", "Francisco Conceição", "Francisco Trincão", "Gonçalo Ramos",
            "Henrique Araújo", "André Silva", "Nélson Semedo"
        ]
    },
    "Uzbekistan": {
        "nation_id": 191,
        "players": [
            "Abduvohid Nematov", "Jamoliddin Abdullayev", "Rustamjon Ashurmatov", "Abdukodir Khusanov",
            "Farrukh Sayfiev", "Otabek Shukurov", "Jasur Yakhshiboev", "Sherzod Nasrullaev",
            "Jaloliddin Masharipov", "Oston Urunov", "Eldor Shomurodov",
            "Utkir Yusupov", "Eldorbek Suyunov", "Zafarmurod Abdurakhmatov", "Umar Eshmurodov",
            "Azizbek Turgunboev", "Dostonbek Khamdamov", "Bobur Abdixoliqov", "Rustam Yusupov",
            "Nodir Toshmatov", "Shamsiddin Karimov", "Dilshod Narzullayev", "Hayot Fayzullaev",
            "Akmal Tukhtasinov", "Mansur Juraev", "Saidakbar Yunusov"
        ]
    },
    "Croacia": {
        "nation_id": 10,
        "players": [
            "Dominik Livaković", "Josip Stanišić", "Josip Šutalo", "Duje Ćaleta-Car",
            "Joško Gvardiol", "Luka Sučić", "Luka Modrić", "Mario Pašalić",
            "Andrej Kramarić", "Ivan Perišić", "Ante Budimir",
            "Dominik Kotarski", "Ivor Pandur", "Marin Pongračić", "Martin Erlić",
            "Luka Vušković", "Mateo Kovačić", "Nikola Vlašić", "Martin Baturina",
            "Kristijan Jakić", "Petar Sučić", "Nikola Moro", "Toni Fruk",
            "Marco Pašalić", "Petar Musa", "Igor Matanović"
        ]
    },
    "Inglaterra": {
        "nation_id": 14,
        "players": [
            "Jordan Pickford", "Reece James", "Marc Guéhi", "Ezri Konsa",
            "Nico O'Reilly", "Elliot Anderson", "Declan Rice", "Bukayo Saka",
            "Jude Bellingham", "Eberechi Eze", "Harry Kane",
            "Dean Henderson", "James Trafford", "Jarell Quansah", "John Stones",
            "Dan Burn", "Djed Spence", "Tino Livramento", "Kobbie Mainoo",
            "Jordan Henderson", "Morgan Rogers", "Ivan Toney", "Ollie Watkins",
            "Marcus Rashford", "Anthony Gordon", "Noni Madueke"
        ]
    },
    "Ghana": {
        "nation_id": 117,
        "players": [
            "Lawrence Ati-Zigi", "Jonas Adjetey", "Alidu Seidu", "Jerome Opoku",
            "Caleb Yirenkyi", "Kwasi Sibo", "Thomas Partey", "Gideon Mensah",
            "Kamaldeen Sulemana", "Antoine Semenyo", "Jordan Ayew",
            "Joseph Wollacott", "Abdul Manaf Nurudeen", "Alexander Djiku", "Mohammed Salisu",
            "Nicholas Opoku", "Ebenezer Annan", "Elisha Owusu", "Abdul Fatawu Issahaku",
            "Salis Abdul Samed", "Daniel-Kofi Kyereh", "Ernest Nuamah", "Joseph Paintsil",
            "Albert Amoah", "Christopher Bonsu Baah", "Jerry Afriyie"
        ]
    },
    "Panama": {
        "nation_id": 87,
        "players": [
            "Orlando Mosquera", "César Blackman", "Andrés Andrade", "José Córdoba",
            "Michael Murillo", "Adalberto Carrasquilla", "Aníbal Godoy", "Eric Davis",
            "Yoel Bárcenas", "Ismael Díaz", "José Fajardo",
            "César Samudio", "José Guerra", "Roderick Miller", "Fidel Escobar",
            "Juan Mosquera", "Cristian Martínez", "Abdiel Arroyo", "Ricardo Clarke",
            "Cecilio Waterman", "José Luis Rodríguez", "Alfredo Stephens", "Edgar Bárcenas",
            "Omar Valencia", "Carlos Harvey", "Jovani Welch"
        ]
    },
}

FUTBIN_BASE = "https://www.futbin.com"
OUTPUT_DIR  = Path("imagenes_mundial")
MAX_RETRIES = 3
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

def slugify(s):
    s = re.sub(r'[<>:"/\\|?*]', '', s.strip())
    return re.sub(r'\s+', '_', s)

def fix_img_url(url: str) -> str:
    if not url: return url
    url = url.split("?")[0]
    url = re.sub(r'cdn\d+\.futbin\.com', 'cdn.futbin.com', url)
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("http://"):
        url = url.replace("http://", "https://")
    return url

def get_high_quality_url(url: str) -> str:
    if not url: return url
    url = re.sub(r'/small/', '/', url)
    url = re.sub(r'/medium/', '/', url)
    url = re.sub(r'(_small|_medium)(\.png|\.jpg|\.webp)', r'\2', url)
    return url

def extract_player_id_from_url(url: str) -> str | None:
    if not url: return None
    match = re.search(r'/player/(\d+)', url)
    if match:
        return match.group(1)
    return None

def download_image(url: str, dest: Path, session: requests.Session) -> bool:
    if dest.exists() and dest.stat().st_size > 500:
        return True
    h = {"User-Agent": UA, "Referer": "https://www.futbin.com/",
         "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"}
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.get(url, headers=h, timeout=20)
            if r.status_code == 200 and len(r.content) > 500:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(r.content)
                return True
        except Exception: pass
        time.sleep(1.5 * attempt)
    return False


def safe_goto(page, url: str, timeout: int = 25000) -> bool:
    """Navega a una URL con manejo de errores robusto."""
    try:
        page.goto(url, timeout=timeout, wait_until="domcontentloaded")
        return True
    except Exception as e:
        print(f"      ⚠️  Error navegando: {str(e)[:80]}")
        return False


def search_player_and_get_id(page, player_name: str, nation_id: int) -> tuple[str, str] | None:
    """
    Busca jugador en Futbin y devuelve (player_id, player_name_encontrado).
    Usa el formato de URL correcto para EA FC 26.
    """
    # Intentar con el nombre provisto de manera exacta
    search_term = player_name
    
    # Bucle inteligente para intentar hasta 3 variaciones de búsqueda si falla
    for attempt in range(3):
        if attempt == 1 and " " in player_name:
            # Reintento 1: usar sólo el último término (generalmente el apellido)
            search_term = player_name.split()[-1]
        elif attempt == 2:
            # Reintento 2: Remover tildes y caracteres especiales con unidecode
            search_term = unidecode(search_term)

        search_url = f"{FUTBIN_BASE}/26/players?page=1&search={quote(search_term)}&nation={nation_id}"

        if not safe_goto(page, search_url, timeout=25000):
            continue

        # Aceptar cookies de manera silenciosa
        try:
            page.click("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", timeout=1500)
            time.sleep(0.2)
        except: pass

        # Esperar carga de resultados
        time.sleep(2.5)

        # Extraer HTML y buscar links a jugadores
        try:
            soup = BeautifulSoup(page.content(), "html.parser")

            player_links = []
            # Buscar todos los links que vayan a /26/player/
            for a in soup.find_all("a", href=re.compile(r'/26/player/\d+')):
                href = a.get("href", "")
                match = re.search(r'/26/player/(\d+)', href)
                if match:
                    pid = match.group(1)
                    name = a.get_text(strip=True)
                    if not name:
                        img = a.find("img")
                        if img: name = img.get("alt", "")
                    if not name:
                        name = player_name
                    player_links.append((pid, name, href))

            if player_links:
                return player_links[0][0], player_links[0][1]

            # Si no encontramos con /26/player/, intentar con /player/ estructural genérico
            for a in soup.find_all("a", href=re.compile(r'/player/\d+')):
                href = a.get("href", "")
                match = re.search(r'/player/(\d+)', href)
                if match:
                    pid = match.group(1)
                    name = a.get_text(strip=True) or player_name
                    return pid, name

        except Exception as e:
            print(f"      ⚠️  Error parseando resultados: {e}")
            
    return None


def extract_player_from_page(page, player_name: str, player_id: str) -> dict | None:
    """
    Extrae información del jugador de la página actual.
    Se asume que ya estamos en la página del jugador.
    """
    result = {
        "name": player_name,
        "rating": "",
        "position": "",
        "card_type": "base",
        "img_url": None,
        "img_url_large": None,
        "player_id": player_id,
        "page_url": page.url
    }

    # Esperar carga de la página del jugador
    time.sleep(2.5)

    # Extraer nombre
    try:
        name_el = page.query_selector("h1")
        if name_el:
            result["name"] = name_el.inner_text().strip()
    except: pass

    # Extraer rating
    try:
        for sel in [".rating", ".pcdisplay-rat", "[class*='rating']"]:
            el = page.query_selector(sel)
            if el:
                text = el.inner_text().strip()
                if text.isdigit():
                    result["rating"] = text
                    break
    except: pass

    # Extraer posición
    try:
        for sel in [".position", ".pcdisplay-pos", "[class*='position']"]:
            el = page.query_selector(sel)
            if el:
                result["position"] = el.inner_text().strip()
                break
    except: pass

    # ── Extraer imagen ───────────────────────────────────────────────────
    img_url = None

    # ESTRATEGIA 1: Selectores CSS directos
    for sel in [
        "img.player-image",
        "img[src*='img/players/']",
        ".player-page-image img",
        "#player-info img",
        "img[src*='/players/']",
        ".pcdisplay img",
        "[class*='pcdisplay'] img",
        "main img",
    ]:
        try:
            img = page.query_selector(sel)
            if img:
                src = img.get_attribute("src") or img.get_attribute("data-src") or ""
                if src and ("futbin.com" in src or "cdn" in src):
                    img_url = fix_img_url(src)
                    break
        except: pass

    # ESTRATEGIA 2: Buscar en HTML completo con BeautifulSoup
    if not img_url:
        try:
            soup = BeautifulSoup(page.content(), "html.parser")
            for img in soup.find_all("img"):
                src = img.get("src") or img.get("data-src") or ""
                if any(p in src for p in ["/players/p", "/img/players/", "cdn.futbin"]):
                    img_url = fix_img_url(src)
                    break
        except: pass

    # ESTRATEGIA 3: Construir URL desde player_id (Fallback absoluto)
    if not img_url and player_id:
        img_url = f"https://cdn.futbin.com/content/fifa25/img/players/{player_id}.png"

    if img_url:
        result["img_url"] = img_url
        result["img_url_large"] = get_high_quality_url(img_url)

        # Detectar tipo de carta
        url_lower = img_url.lower()
        if "/toty/" in url_lower: result["card_type"] = "TOTY"
        elif "/tots/" in url_lower: result["card_type"] = "TOTS"
        elif "/if/" in url_lower: result["card_type"] = "IF"
        elif "/icon/" in url_lower: result["card_type"] = "Icon"
        elif "/hero/" in url_lower: result["card_type"] = "Hero"
        elif any(x in url_lower for x in ["/wc/", "/rtwc/"]): result["card_type"] = "WC"
        elif "/shapeshifter/" in url_lower: result["card_type"] = "Shapeshifter"

        return result

    return None


def get_player_data(page, player_name: str, nation_id: int) -> dict | None:
    """
    Función principal: busca jugador y extrae sus datos.
    """
    # Paso 1: Buscar y obtener ID (con reintentos inteligentes incorporados)
    search_result = search_player_and_get_id(page, player_name, nation_id)
    if not search_result:
        return None

    player_id, found_name = search_result

    # Paso 2: Navegar a la página del jugador
    player_url = f"{FUTBIN_BASE}/26/player/{player_id}/{slugify(found_name)}"
    if not safe_goto(page, player_url, timeout=25000):
        return None

    # Paso 3: Extraer datos
    return extract_player_from_page(page, found_name, player_id)


class FutbinScraper:
    def __init__(self, output_dir=OUTPUT_DIR, delay_search=2.5, delay_nation=4.0):
        self.output_dir    = Path(output_dir)
        self.delay_search  = delay_search
        self.delay_nation  = delay_nation
        self.session       = requests.Session()
        self.stats         = {
            "nations": 0,
            "players_found": 0,
            "players_missing": 0,
            "ok": 0,
            "fail": 0,
            "by_card_type": {}
        }

    def scrape_nation(self, nation_name: str, nation_id: int,
                      players_list: list, page) -> list:
        results = []
        found = missing = 0

        parsed_players = []
        for p in players_list:
            if isinstance(p, str) and p.startswith("{"):
                try:
                    parsed = eval(p)
                    parsed_players.append(parsed.get("name", p))
                except:
                    parsed_players.append(p)
            else:
                parsed_players.append(p)

        print(f"\n  🌍  {nation_name}  ({len(parsed_players)} jugadores)")

        for player_name in parsed_players:
            result = None
            try:
                # Realizar búsqueda limpia
                result = get_player_data(page, player_name, nation_id)
            except Exception as e:
                pass

            if result:
                results.append(result)
                found += 1
                card_type = result.get("card_type", "base")
                self.stats["by_card_type"][card_type] = self.stats["by_card_type"].get(card_type, 0) + 1
                print(f"    ✅  {result['name']:30s} {result['rating']:>3s}  [{card_type:12s}]")
            else:
                missing += 1
                print(f"    ❌  {player_name:30s} — no encontrado")

            time.sleep(self.delay_search)

        self.stats["players_found"]   += found
        self.stats["players_missing"] += missing
        print(f"  → {found} encontrados, {missing} no encontrados")
        return results

    def download_images(self, nation_name: str, players: list):
        nation_dir = self.output_dir / slugify(nation_name)
        nation_dir.mkdir(parents=True, exist_ok=True)
        ok = fail = 0

        for p in players:
            urls_to_try = []
            if p.get("img_url_large"):
                urls_to_try.append(p["img_url_large"])
            if p.get("img_url"):
                urls_to_try.append(p["img_url"])

            downloaded = False
            for url in urls_to_try:
                if not url:
                    continue
                fname = f"{slugify(p['name'])}_{p.get('card_type', 'base')}.png"
                dest = nation_dir / fname
                if download_image(url, dest, self.session):
                    downloaded = True
                    break

            if downloaded:
                ok += 1
            else:
                fail += 1

        self.stats["ok"] += ok
        self.stats["fail"] += fail
        print(f"    📥  {ok} imagenes descargadas, {fail} fallidas")

        (nation_dir / "_jugadores.json").write_text(
            json.dumps(players, ensure_ascii=False, indent=2), encoding="utf-8")

    def run(self, squads: dict):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        total_players = sum(len(v["players"]) for v in squads.values())
        print("\n" + "="*60)
        print("  FUTBIN — Fotos Planteles Mundial 2026")
        print(f"  Selecciones : {len(squads)}")
        print(f"  Jugadores   : {total_players}")
        print(f"  Salida      : {self.output_dir.resolve()}")
        print("="*60)

        def _run(p):
            browser = p.chromium.launch(
                headless=False,
                args=["--disable-blink-features=AutomationControlled",
                      "--no-sandbox","--window-size=1280,900","--window-position=0,0"]
            )
            ctx = browser.new_context(
                user_agent=UA, viewport={"width":1280,"height":900},
                locale="en-US", timezone_id="America/New_York",
                screen={"width":1920,"height":1080},
                extra_http_headers={
                    "Accept-Language":"en-US,en;q=0.9",
                    "sec-ch-ua":'"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
                    "sec-ch-ua-mobile":"?0","sec-ch-ua-platform":'"Windows"'}
            )

            ctx.route("**/*", lambda r: r.abort()
                if any(x in r.request.url for x in [".woff2",".woff",".ttf","google-analytics","doubleclick"])
                else r.continue_())

            page = ctx.new_page()
            print("\n  🔄  Iniciando sesion...")

            if not safe_goto(page, FUTBIN_BASE, timeout=25000):
                print("  ❌  No se pudo cargar Futbin. Verifica tu conexion.")
                browser.close()
                return

            time.sleep(3)
            try:
                page.click("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll", timeout=4000)
                time.sleep(1)
            except: pass
            print("  ✅  Listo\n")

            items = list(squads.items())
            for i, (nation, info) in enumerate(items, 1):
                print(f"\n[{i}/{len(items)}] {nation}")
                players = self.scrape_nation(nation, info["nation_id"], info["players"], page)
                self.stats["nations"] += 1
                if players:
                    self.download_images(nation, players)
                time.sleep(self.delay_nation)

            browser.close()

        with sync_playwright() as p:
            _run(p)

        self._summary()

    def _summary(self):
        print("\n" + "="*60)
        print("  RESUMEN FINAL")
        print(f"  Selecciones        : {self.stats['nations']}")
        print(f"  Jugadores hallados : {self.stats['players_found']}")
        print(f"  No encontrados     : {self.stats['players_missing']}")
        print(f"  Imagenes OK        : {self.stats['ok']}")
        print(f"  Imagenes fallidas  : {self.stats['fail']}")
        print("\n  Por tipo de carta:")
        for card_type, count in sorted(self.stats["by_card_type"].items()):
            print(f"    {card_type:15s}: {count}")
        print(f"\n  Carpeta            : {self.output_dir.resolve()}")
        print("="*60 + "\n")


def main():
    ap = argparse.ArgumentParser(description="Fotos planteles Mundial 2026 — Futbin")
    ap.add_argument("--nation",       type=str,  default=None)
    ap.add_argument("--list-nations", action="store_true")
    ap.add_argument("--output",       type=str,  default="imagenes_mundial")
    ap.add_argument("--delay",        type=float, default=2.5,
                    help="Segundos entre busquedas de jugadores (default 2.5)")
    args = ap.parse_args()

    if args.list_nations:
        print("\nSelecciones disponibles:\n")
        for i, (n, info) in enumerate(sorted(WC2026_SQUADS.items()), 1):
            print(f"  {i:3d}. {n:<25} ID:{info['nation_id']:4d}  ({len(info['players'])} jugadores)")
        return

    scraper = FutbinScraper(output_dir=args.output, delay_search=args.delay)

    if args.nation:
        matches = {k: v for k, v in WC2026_SQUADS.items()
                   if args.nation.lower() in k.lower()}
        if not matches:
            print(f"'{args.nation}' no encontrada. Usa --list-nations"); sys.exit(1)
        scraper.run(squads=matches)
    else:
        scraper.run(squads=WC2026_SQUADS)

if __name__ == "__main__":
    main()