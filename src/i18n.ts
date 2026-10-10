import { useSyncExternalStore } from 'react'

export type Language = 'en' | 'es' | 'pt-BR' | 'hi' | 'fr'
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'fr', name: 'Français' },
]

const key = 'kickoff-star-language'
function normalise(value: string | null): Language {
  if (value === 'es' || value === 'pt-BR' || value === 'hi' || value === 'fr') return value
  if (value?.startsWith('es')) return 'es'
  if (value?.startsWith('pt')) return 'pt-BR'
  if (value?.startsWith('hi')) return 'hi'
  if (value?.startsWith('fr')) return 'fr'
  return 'en'
}
let language: Language = normalise(localStorage.getItem(key) ?? navigator.language)
const listeners = new Set<() => void>()
export function getLanguage() { return language }
export function setLanguage(next: Language) {
  language = next
  localStorage.setItem(key, next)
  document.documentElement.lang = next
  listeners.forEach((listener) => listener())
}
export function useLanguage() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, getLanguage)
}
document.documentElement.lang = language

// The key itself is the English fallback. Missing story translations stay legible.
const translations: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  es: {
    'the journey starts here': 'el viaje empieza aquí', 'from school football to a pro contract': 'del fútbol escolar a un contrato profesional',
    'New Career': 'Nueva carrera', 'Start your journey': 'Comienza tu camino', 'Continue': 'Continuar', 'Continue your saved career': 'Continúa tu carrera guardada',
    'Load Career': 'Cargar carrera', 'Load a previously saved career': 'Carga una carrera guardada', 'Help': 'Ayuda', 'How Kickoff Star works': 'Cómo funciona Kickoff Star',
    'Settings': 'Ajustes', 'Game settings and preferences': 'Opciones y preferencias del juego', 'Credits': 'Créditos', 'Meet the team': 'Conoce al equipo',
    'Every legend started somewhere.': 'Toda leyenda empezó en algún lugar.', 'PHASE 1 COMPLETE': 'FASE 1 COMPLETA', 'RELEASE': 'VERSIÓN', 'loading': 'cargando',
    'Back': 'Volver', 'Tune the game for your device and play style.': 'Adapta el juego a tu dispositivo y a tu forma de jugar.',
    'Language': 'Idioma', 'Choose the language for the game interface.': 'Elige el idioma de la interfaz del juego.',
    'Menu music': 'Música del menú', 'Five original Kickoff Star tracks play in sequence. Match sounds have their own mute control.': 'Cinco pistas originales de Kickoff Star suenan en secuencia. Los sonidos del partido tienen su propio control.',
    'Reduced motion': 'Reducir movimiento', 'Minimises menu and match animations. Useful on slower phones or if motion is distracting.': 'Reduce las animaciones del menú y los partidos. Útil en móviles lentos o si el movimiento distrae.',
    'Performance mode': 'Modo rendimiento', 'Cuts expensive glow, blur and decorative effects while keeping the football animations and gameplay intact.': 'Reduce brillos, desenfoques y adornos sin afectar el juego.',
    'NEXT TRACK →': 'SIGUIENTE PISTA →', 'ON': 'SÍ', 'OFF': 'NO', 'Privacy policy ↗': 'Política de privacidad ↗',
    'Your career saves remain stored locally on this device. Settings are also saved locally.': 'Tus partidas y ajustes se guardan en este dispositivo.',
    'Need a hand?': '¿Necesitas ayuda?', 'How to Play': 'Cómo jugar',
    'Your goal in Phase 1 is simple: survive the youth game, improve, get noticed and earn your first professional contract.': 'Tu objetivo en la Fase 1: crecer en el fútbol juvenil, destacar y conseguir tu primer contrato profesional.',
    'Energy': 'Energía', 'Matches': 'Partidos', 'Training': 'Entrenamiento', 'Selection': 'Selección',
    'Normal play should be sustainable. Rest before you are completely drained; recovery items are for emergencies, not mandatory progression.': 'Descansa antes de quedarte sin energía. Los objetos de recuperación son para emergencias.',
    'Choices are judged by situation and your attributes. A sensible decision can still fail through execution or football randomness.': 'Tus decisiones dependen de la situación y tus atributos. Incluso una buena idea puede fallar.',
    'Higher intensity gives more development but costs more energy and carries more risk.': 'Más intensidad mejora tu desarrollo, pero gasta energía y aumenta el riesgo.',
    'Form, coach trust and development all matter. Being benched is a setback, not the end of your career.': 'Importan la forma, la confianza del entrenador y el desarrollo. Ir al banquillo no acaba tu carrera.',
    'back': 'volver', 'what\'s your name?': '¿cómo te llamas?', 'pick your position': 'elige tu posición', 'preferred foot': 'pie dominante', 'pick your look': 'elige tu aspecto', 'choose your country': 'elige tu país', 'choose your region': 'elige tu región', 'what kind of player are you?': '¿qué tipo de jugador eres?',
    'every legend needs a name.': 'toda leyenda necesita un nombre.', 'where do you want to make your mark?': '¿dónde quieres destacar?', 'which foot do you trust?': '¿con qué pie juegas?', 'this is the face of your career.': 'este será el rostro de tu carrera.', 'your nation — one day they might come calling.': 'tu selección podría llamarte algún día.', 'your first schools and clubs come from here.': 'aquí empieza tu camino en escuelas y clubes.', 'one defining trait. it shapes your attributes and how you play, permanently.': 'un rasgo que define tus atributos y tu estilo para siempre.',
    'your name': 'tu nombre', 'left': 'izquierdo', 'right': 'derecho', 'continue': 'continuar', 'begin your career': 'comenzar carrera',
    'Goalkeeper': 'Portero', 'Centre-Back': 'Defensa central', 'Full-Back': 'Lateral', 'Midfielder': 'Centrocampista', 'Wide Mid': 'Interior', 'Winger': 'Extremo', 'Striker': 'Delantero',
    'Career events and Gazette stories are currently in English.': 'Los eventos de carrera y las historias de la Gazette siguen en inglés.',
    'Your journeys': 'Tus carreras', 'Choose the career you want to continue.': 'Elige la carrera que quieres continuar.', 'Checking saves…': 'Buscando partidas…', 'SLOT': 'ESPACIO', 'Empty slot': 'Espacio vacío', 'Age': 'Edad', 'Saved': 'Guardado',
    'home': 'inicio', 'player': 'jugador', 'people': 'personas', 'club': 'club', 'league': 'liga', 'shop': 'tienda', 'MENU': 'MENÚ', 'ENERGY': 'ENERGÍA', 'Career navigation': 'Navegación de carrera',
  },
  'pt-BR': {
    'the journey starts here': 'a jornada começa aqui', 'from school football to a pro contract': 'do futebol escolar ao contrato profissional',
    'New Career': 'Nova carreira', 'Start your journey': 'Comece sua jornada', 'Continue': 'Continuar', 'Continue your saved career': 'Continue sua carreira salva',
    'Load Career': 'Carregar carreira', 'Load a previously saved career': 'Carregue uma carreira salva', 'Help': 'Ajuda', 'How Kickoff Star works': 'Como funciona Kickoff Star',
    'Settings': 'Configurações', 'Game settings and preferences': 'Opções e preferências do jogo', 'Credits': 'Créditos', 'Meet the team': 'Conheça a equipe',
    'Every legend started somewhere.': 'Toda lenda começou em algum lugar.', 'PHASE 1 COMPLETE': 'FASE 1 CONCLUÍDA', 'RELEASE': 'VERSÃO', 'loading': 'carregando',
    'Back': 'Voltar', 'Tune the game for your device and play style.': 'Ajuste o jogo ao seu aparelho e estilo de jogo.',
    'Language': 'Idioma', 'Choose the language for the game interface.': 'Escolha o idioma da interface do jogo.',
    'Menu music': 'Música do menu', 'Five original Kickoff Star tracks play in sequence. Match sounds have their own mute control.': 'Cinco faixas originais de Kickoff Star tocam em sequência. Os sons das partidas têm controle próprio.',
    'Reduced motion': 'Reduzir movimento', 'Minimises menu and match animations. Useful on slower phones or if motion is distracting.': 'Reduz as animações do menu e das partidas. Útil em aparelhos lentos ou se o movimento incomoda.',
    'Performance mode': 'Modo desempenho', 'Cuts expensive glow, blur and decorative effects while keeping the football animations and gameplay intact.': 'Reduz brilhos, desfoques e efeitos decorativos sem afetar o jogo.',
    'NEXT TRACK →': 'PRÓXIMA FAIXA →', 'ON': 'SIM', 'OFF': 'NÃO', 'Privacy policy ↗': 'Política de privacidade ↗',
    'Your career saves remain stored locally on this device. Settings are also saved locally.': 'Suas carreiras e configurações ficam salvas neste aparelho.',
    'Need a hand?': 'Precisa de ajuda?', 'How to Play': 'Como jogar',
    'Your goal in Phase 1 is simple: survive the youth game, improve, get noticed and earn your first professional contract.': 'Seu objetivo na Fase 1: crescer no futebol de base, chamar atenção e conquistar seu primeiro contrato profissional.',
    'Energy': 'Energia', 'Matches': 'Partidas', 'Training': 'Treino', 'Selection': 'Convocação',
    'Normal play should be sustainable. Rest before you are completely drained; recovery items are for emergencies, not mandatory progression.': 'Descanse antes de esgotar sua energia. Itens de recuperação são para emergências.',
    'Choices are judged by situation and your attributes. A sensible decision can still fail through execution or football randomness.': 'Suas escolhas dependem da situação e dos seus atributos. Até uma boa decisão pode falhar.',
    'Higher intensity gives more development but costs more energy and carries more risk.': 'Mais intensidade acelera o desenvolvimento, mas consome energia e aumenta o risco.',
    'Form, coach trust and development all matter. Being benched is a setback, not the end of your career.': 'Forma, confiança do técnico e evolução importam. Ficar no banco não acaba com a carreira.',
    'back': 'voltar', 'what\'s your name?': 'qual é o seu nome?', 'pick your position': 'escolha sua posição', 'preferred foot': 'pé preferido', 'pick your look': 'escolha sua aparência', 'choose your country': 'escolha seu país', 'choose your region': 'escolha sua região', 'what kind of player are you?': 'que tipo de jogador você é?',
    'every legend needs a name.': 'toda lenda precisa de um nome.', 'where do you want to make your mark?': 'onde você quer se destacar?', 'which foot do you trust?': 'com qual pé você joga?', 'this is the face of your career.': 'este será o rosto da sua carreira.', 'your nation — one day they might come calling.': 'sua seleção pode convocar você um dia.', 'your first schools and clubs come from here.': 'suas primeiras escolas e clubes vêm daqui.', 'one defining trait. it shapes your attributes and how you play, permanently.': 'uma característica que molda seus atributos e seu estilo para sempre.',
    'your name': 'seu nome', 'left': 'esquerdo', 'right': 'direito', 'continue': 'continuar', 'begin your career': 'começar carreira',
    'Goalkeeper': 'Goleiro', 'Centre-Back': 'Zagueiro', 'Full-Back': 'Lateral', 'Midfielder': 'Meio-campista', 'Wide Mid': 'Meia aberto', 'Winger': 'Ponta', 'Striker': 'Atacante',
    'Career events and Gazette stories are currently in English.': 'Os eventos da carreira e as histórias da Gazette ainda estão em inglês.',
    'Your journeys': 'Suas carreiras', 'Choose the career you want to continue.': 'Escolha a carreira que deseja continuar.', 'Checking saves…': 'Verificando partidas…', 'SLOT': 'ESPAÇO', 'Empty slot': 'Espaço vazio', 'Age': 'Idade', 'Saved': 'Salvo',
    'home': 'início', 'player': 'jogador', 'people': 'pessoas', 'club': 'clube', 'league': 'liga', 'shop': 'loja', 'MENU': 'MENU', 'ENERGY': 'ENERGIA', 'Career navigation': 'Navegação da carreira',
  },
  hi: {
    'the journey starts here': 'सफ़र यहाँ से शुरू होता है', 'from school football to a pro contract': 'स्कूल फ़ुटबॉल से प्रो अनुबंध तक',
    'New Career': 'नया करियर', 'Start your journey': 'अपना सफ़र शुरू करें', 'Continue': 'जारी रखें', 'Continue your saved career': 'अपना सेव किया करियर जारी रखें',
    'Load Career': 'करियर लोड करें', 'Load a previously saved career': 'पहले सेव किया करियर खोलें', 'Help': 'मदद', 'How Kickoff Star works': 'Kickoff Star कैसे खेलें',
    'Settings': 'सेटिंग्स', 'Game settings and preferences': 'गेम की सेटिंग्स और पसंद', 'Credits': 'श्रेय', 'Meet the team': 'टीम से मिलें',
    'Every legend started somewhere.': 'हर दिग्गज ने कहीं न कहीं से शुरुआत की थी।', 'PHASE 1 COMPLETE': 'पहला चरण पूरा', 'RELEASE': 'संस्करण', 'loading': 'लोड हो रहा है',
    'Back': 'वापस', 'Tune the game for your device and play style.': 'अपने फ़ोन और खेलने के तरीके के अनुसार गेम सेट करें।',
    'Language': 'भाषा', 'Choose the language for the game interface.': 'गेम इंटरफ़ेस की भाषा चुनें।',
    'Menu music': 'मेनू संगीत', 'Five original Kickoff Star tracks play in sequence. Match sounds have their own mute control.': 'Kickoff Star के पाँच मूल गाने क्रम से बजते हैं। मैच की आवाज़ अलग से बंद की जा सकती है।',
    'Reduced motion': 'कम एनिमेशन', 'Minimises menu and match animations. Useful on slower phones or if motion is distracting.': 'मेनू और मैच के एनिमेशन कम करता है। धीमे फ़ोन पर उपयोगी है।',
    'Performance mode': 'प्रदर्शन मोड', 'Cuts expensive glow, blur and decorative effects while keeping the football animations and gameplay intact.': 'गेमप्ले बनाए रखते हुए चमक और धुंधले प्रभाव कम करता है।',
    'NEXT TRACK →': 'अगला गाना →', 'ON': 'चालू', 'OFF': 'बंद', 'Privacy policy ↗': 'गोपनीयता नीति ↗',
    'Your career saves remain stored locally on this device. Settings are also saved locally.': 'करियर सेव और सेटिंग्स इसी डिवाइस पर रहती हैं।',
    'Need a hand?': 'मदद चाहिए?', 'How to Play': 'कैसे खेलें',
    'Your goal in Phase 1 is simple: survive the youth game, improve, get noticed and earn your first professional contract.': 'पहले चरण में युवा फ़ुटबॉल खेलें, बेहतर बनें, ध्यान आकर्षित करें और अपना पहला प्रो अनुबंध पाएँ।',
    'Energy': 'ऊर्जा', 'Matches': 'मैच', 'Training': 'अभ्यास', 'Selection': 'चयन',
    'Normal play should be sustainable. Rest before you are completely drained; recovery items are for emergencies, not mandatory progression.': 'ऊर्जा खत्म होने से पहले आराम करें। रिकवरी आइटम आपात स्थिति के लिए हैं।',
    'Choices are judged by situation and your attributes. A sensible decision can still fail through execution or football randomness.': 'फ़ैसले स्थिति और आपकी क्षमताओं पर निर्भर हैं। अच्छा फ़ैसला भी विफल हो सकता है।',
    'Higher intensity gives more development but costs more energy and carries more risk.': 'कड़े अभ्यास से विकास तेज़ होता है, लेकिन ऊर्जा और जोखिम बढ़ते हैं।',
    'Form, coach trust and development all matter. Being benched is a setback, not the end of your career.': 'फ़ॉर्म, कोच का भरोसा और विकास मायने रखते हैं। बेंच पर बैठना करियर का अंत नहीं है।',
    'back': 'वापस', 'what\'s your name?': 'आपका नाम क्या है?', 'pick your position': 'अपनी पोज़िशन चुनें', 'preferred foot': 'पसंदीदा पैर', 'pick your look': 'अपना रूप चुनें', 'choose your country': 'अपना देश चुनें', 'choose your region': 'अपना क्षेत्र चुनें', 'what kind of player are you?': 'आप कैसे खिलाड़ी हैं?',
    'every legend needs a name.': 'हर दिग्गज का एक नाम होता है।', 'where do you want to make your mark?': 'आप कहाँ खेलना चाहते हैं?', 'which foot do you trust?': 'आप किस पैर से खेलते हैं?', 'this is the face of your career.': 'यह आपके करियर का चेहरा होगा।', 'your nation — one day they might come calling.': 'एक दिन आपकी राष्ट्रीय टीम आपको बुला सकती है।', 'your first schools and clubs come from here.': 'आपके पहले स्कूल और क्लब यहीं से मिलेंगे।', 'one defining trait. it shapes your attributes and how you play, permanently.': 'एक खास गुण जो आपकी क्षमता और खेल शैली को हमेशा के लिए तय करेगा।',
    'your name': 'आपका नाम', 'left': 'बायाँ', 'right': 'दायाँ', 'continue': 'आगे बढ़ें', 'begin your career': 'करियर शुरू करें',
    'Goalkeeper': 'गोलकीपर', 'Centre-Back': 'सेंटर बैक', 'Full-Back': 'फुल बैक', 'Midfielder': 'मिडफ़ील्डर', 'Wide Mid': 'वाइड मिडफ़ील्डर', 'Winger': 'विंगर', 'Striker': 'स्ट्राइकर',
    'Career events and Gazette stories are currently in English.': 'करियर इवेंट और Gazette की कहानियाँ अभी अंग्रेज़ी में हैं।',
    'Your journeys': 'आपके करियर', 'Choose the career you want to continue.': 'वह करियर चुनें जिसे जारी रखना है।', 'Checking saves…': 'सेव खोजे जा रहे हैं…', 'SLOT': 'स्लॉट', 'Empty slot': 'खाली स्लॉट', 'Age': 'उम्र', 'Saved': 'सेव किया गया',
    'home': 'होम', 'player': 'खिलाड़ी', 'people': 'लोग', 'club': 'क्लब', 'league': 'लीग', 'shop': 'दुकान', 'MENU': 'मेनू', 'ENERGY': 'ऊर्जा', 'Career navigation': 'करियर नेविगेशन',
  },
  fr: {
    'the journey starts here': 'l’aventure commence ici', 'from school football to a pro contract': 'du football scolaire au contrat pro',
    'New Career': 'Nouvelle carrière', 'Start your journey': 'Commencez votre aventure', 'Continue': 'Continuer', 'Continue your saved career': 'Reprenez votre carrière',
    'Load Career': 'Charger une carrière', 'Load a previously saved career': 'Chargez une carrière sauvegardée', 'Help': 'Aide', 'How Kickoff Star works': 'Comment jouer à Kickoff Star',
    'Settings': 'Paramètres', 'Game settings and preferences': 'Options et préférences du jeu', 'Credits': 'Crédits', 'Meet the team': 'Rencontrez l’équipe',
    'Every legend started somewhere.': 'Chaque légende a commencé quelque part.', 'PHASE 1 COMPLETE': 'PHASE 1 TERMINÉE', 'RELEASE': 'VERSION', 'loading': 'chargement',
    'Back': 'Retour', 'Tune the game for your device and play style.': 'Adaptez le jeu à votre appareil et à votre façon de jouer.',
    'Language': 'Langue', 'Choose the language for the game interface.': 'Choisissez la langue de l’interface du jeu.',
    'Menu music': 'Musique du menu', 'Five original Kickoff Star tracks play in sequence. Match sounds have their own mute control.': 'Cinq morceaux originaux de Kickoff Star s’enchaînent. Les sons du match ont leur propre commande.',
    'Reduced motion': 'Réduire les animations', 'Minimises menu and match animations. Useful on slower phones or if motion is distracting.': 'Réduit les animations du menu et des matchs. Utile sur les appareils plus lents.',
    'Performance mode': 'Mode performance', 'Cuts expensive glow, blur and decorative effects while keeping the football animations and gameplay intact.': 'Réduit les effets lumineux et les flous sans modifier le jeu.',
    'NEXT TRACK →': 'MORCEAU SUIVANT →', 'ON': 'OUI', 'OFF': 'NON', 'Privacy policy ↗': 'Politique de confidentialité ↗',
    'Your career saves remain stored locally on this device. Settings are also saved locally.': 'Vos carrières et paramètres restent enregistrés sur cet appareil.',
    'Need a hand?': 'Besoin d’aide ?', 'How to Play': 'Comment jouer',
    'Your goal in Phase 1 is simple: survive the youth game, improve, get noticed and earn your first professional contract.': 'Votre objectif en phase 1 : progresser dans le football des jeunes, vous faire remarquer et décrocher votre premier contrat professionnel.',
    'Energy': 'Énergie', 'Matches': 'Matchs', 'Training': 'Entraînement', 'Selection': 'Sélection',
    'Normal play should be sustainable. Rest before you are completely drained; recovery items are for emergencies, not mandatory progression.': 'Reposez-vous avant d’épuiser votre énergie. Les objets de récupération servent en cas d’urgence.',
    'Choices are judged by situation and your attributes. A sensible decision can still fail through execution or football randomness.': 'Vos choix dépendent de la situation et de vos attributs. Une bonne décision peut quand même échouer.',
    'Higher intensity gives more development but costs more energy and carries more risk.': 'Un entraînement plus intense accélère la progression, mais coûte de l’énergie et augmente les risques.',
    'Form, coach trust and development all matter. Being benched is a setback, not the end of your career.': 'La forme, la confiance du coach et la progression comptent. Le banc ne marque pas la fin de votre carrière.',
    'back': 'retour', 'what\'s your name?': 'comment t’appelles-tu ?', 'pick your position': 'choisis ton poste', 'preferred foot': 'pied préféré', 'pick your look': 'choisis ton apparence', 'choose your country': 'choisis ton pays', 'choose your region': 'choisis ta région', 'what kind of player are you?': 'quel genre de joueur es-tu ?',
    'every legend needs a name.': 'chaque légende a besoin d’un nom.', 'where do you want to make your mark?': 'à quel poste veux-tu briller ?', 'which foot do you trust?': 'avec quel pied joues-tu ?', 'this is the face of your career.': 'ce sera le visage de ta carrière.', 'your nation — one day they might come calling.': 'ta sélection pourrait t’appeler un jour.', 'your first schools and clubs come from here.': 'tes premières écoles et clubs viennent d’ici.', 'one defining trait. it shapes your attributes and how you play, permanently.': 'un trait qui façonne tes attributs et ton jeu pour toujours.',
    'your name': 'ton nom', 'left': 'gauche', 'right': 'droit', 'continue': 'continuer', 'begin your career': 'commencer la carrière',
    'Goalkeeper': 'Gardien', 'Centre-Back': 'Défenseur central', 'Full-Back': 'Latéral', 'Midfielder': 'Milieu', 'Wide Mid': 'Milieu excentré', 'Winger': 'Ailier', 'Striker': 'Attaquant',
    'Career events and Gazette stories are currently in English.': 'Les événements de carrière et les articles de la Gazette sont encore en anglais.',
    'Your journeys': 'Vos carrières', 'Choose the career you want to continue.': 'Choisissez la carrière à reprendre.', 'Checking saves…': 'Recherche des sauvegardes…', 'SLOT': 'EMPLACEMENT', 'Empty slot': 'Emplacement vide', 'Age': 'Âge', 'Saved': 'Sauvegardé',
    'home': 'accueil', 'player': 'joueur', 'people': 'relations', 'club': 'club', 'league': 'ligue', 'shop': 'boutique', 'MENU': 'MENU', 'ENERGY': 'ÉNERGIE', 'Career navigation': 'Navigation de carrière',
  },
}

export function translate(value: string): string {
  return language === 'en' ? value : (translations[language][value] ?? value)
}
export function useTranslate() {
  useLanguage()
  return translate
}
