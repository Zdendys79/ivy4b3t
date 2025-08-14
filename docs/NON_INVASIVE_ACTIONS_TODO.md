# 📋 TODO: Neinvazivní Facebook Akce

Plán pro postupnou implementaci neinvazivních aktivit na Facebooku pro přirozené chování účtů po rozjezdu.

## ✅ **DOKONČENÉ AKCE**
- ✅ **group_explore** - Prozkoumávání skupin (implementováno)
- ✅ **quote_post** - Vkládání citátů (implementováno)

## 🎯 **PRIORITY 1 - Nejbezpečnější pro start**

### 📖 **Procházení a Konzumace obsahu**
- [ ] **stories_view** - Proklikání FB/Instagram stories přátel
  - Implementace: Najít stories v pravém menu, náhodně proklikat 2-5 stories
  - Čas: 10-30s per story
  - Riziko: Velmi nízké

- [ ] **video_watch** - Krátké zhlédnutí videí ve feedu (5-30s)
  - Implementace: Detekce video elementů, spuštění, sledování 5-30s
  - Scrolling behavior během sledování
  - Riziko: Velmi nízké

- [ ] **feed_scroll** - Procházení hlavního feedu
  - Implementace: Scrollování s realistickými pauzami na zajímavém obsahu
  - Simulace "čtení" příspěvků
  - Riziko: Nejnižší možné

### 👀 **Profile/Group Browsing** 
- [ ] **profile_visit** - Návštěvy profilů přátel (bez interakce)
  - Implementace: Klik na jméno/foto, procházení profilu, návrat
  - Čas: 30s-2min na profil
  - Riziko: Velmi nízké

- [ ] **group_lurking** - Čtení ve skupinách bez postování  
  - Implementace: Navštívení skupiny, scrolling, čtení příspěvků
  - Bez jakékoli interakce
  - Riziko: Velmi nízké

## 🎯 **PRIORITY 2 - Micro-engagement**

### 🔔 **Oznámení a Events**
- [ ] **notifications_check** - Proklikání několika náhodně vybraných novinek
  - Implementace: Otevření notifications, proklik 2-4 oznámení
  - Označení jako přečtené
  - Riziko: Nízké

- [ ] **event_responses** - Označování "Interested/Going" na události
  - Implementace: Hledání lokálních eventů, náhodné responses
  - Upřednostnit "Interested" před "Going"
  - Riziko: Nízké

### 🛒 **Marketplace a Pages**
- [ ] **marketplace_browse** - Procházení nabídek (bez kupování)
  - Implementace: Otevření marketplace, scrolling kategorií
  - Prohlížení produktů bez kontaktování prodejců
  - Riziko: Velmi nízké

- [ ] **page_follow** - Sledování firemních stránek
  - Implementace: Hledání relevantních pages podle zájmů uživatele
  - Pouze "Follow", ne "Like"
  - Riziko: Nízké

## 🎯 **PRIORITY 3 - Active Engagement**

### 💌 **Messaging**
- [ ] **messenger_read** - Pročtení zpráv (rozšíření current messenger_check)
  - Implementace: Rozšířit současnou akci o detailnější čtení
  - Označování zpráv jako přečtené
  - Riziko: Nízké

- [ ] **messenger_reply** - Odpovídání na zprávy (již implementováno)
  - Status: ✅ Již existuje

### 👥 **Social Actions**  
- [ ] **friend_requests** - Přidávání přátel
  - Implementace: Suggestions seznam, opatrné přidávání (1-2/den max)
  - Kontrola mutual friends
  - Riziko: Střední

- [ ] **friend_follow** - Sledování přátel a stránek
  - Implementace: Follow button na profilech
  - Méně invazivní než friend request
  - Riziko: Nízké

### 🎭 **Reactions a Sharing**
- [ ] **timeline_reactions** - Reakce na vlastní timeline
  - Implementace: Like/love vlastních starších postů
  - Reactions na komentáře přátel na vlastních postech
  - Riziko: Velmi nízké

- [ ] **content_sharing** - Sdílení obsahu
  - Implementace: Share zajímavých článků na vlastní timeline
  - Pouze kvalitní, relevantní obsah
  - Riziko: Střední

## 🎯 **PRIORITY 4 - Údržba profilu**

### ⚙️ **Profile Management**
- [ ] **privacy_review** - Občasná kontrola nastavení
  - Implementace: Navigace do Settings, browsing bez změn
  - Simulace "kontroly" zabezpečení
  - Riziko: Velmi nízké

- [ ] **profile_update** - Drobné úpravy profilu
  - Implementace: Úprava bio, aktualizace work/education info
  - Pouze drobné změny, ne kompletní přepis
  - Riziko: Nízké

- [ ] **memory_browse** - Procházení "Vzpomínek" z minulých let
  - Implementace: Otevření Memories sekce, scrolling
  - Občasný like na vlastní staré příspěvky
  - Riziko: Velmi nízké

### 🧹 **Timeline Cleanup**
- [ ] **timeline_cleanup** - Mazání starých postů (OPATRNĚ!)
  - Implementace: Velmi opatrné mazání pouze spam/test postů
  - Maximálně 1-2 posty za týden
  - Riziko: Střední - může vypadat podezřele

## 📊 **IMPLEMENTAČNÍ POZNÁMKY**

### 🔧 **Technické požadavky:**
- Všechny akce dědí z `BaseAction`
- Standardní error handling a logging
- Respektování browser timeouts a wait patterns
- Behavioral profile integration pro přirozené chování

### 📈 **Postupná aktivace:**
1. **Týden 1-2:** Priority 1 akce (nejbezpečnější)
2. **Týden 3-4:** Priority 2 akce (micro-engagement)  
3. **Týden 5-6:** Priority 3 akce (active engagement)
4. **Týden 7+:** Priority 4 akce (údržba profilu)

### ⚠️ **Bezpečnostní pravidla:**
- **Nízká frekvence:** Maximálně 2-3 neinvazivní akce za wheel session
- **Náhodnost:** Různé kombinace akcí pro každého uživatele
- **Behavioral profiling:** Různé chování podle personality typu
- **Postupnost:** Žádné náhlé změny v activity patterns

### 🎯 **Cíle systému:**
- Udržovat účty "teplé" mezi posting sessions
- Simulovat přirozenou Facebook aktivitu
- Minimalizovat riziko detekce algoritmem
- Připravit půdu pro postupné zvyšování posting aktivity

---

**📝 Status:** Dokumentace vytvořena 2025-08-14  
**👨‍💻 Implementace:** Postupná podle priority  
**🔄 Update:** Průběžně podle pokroku