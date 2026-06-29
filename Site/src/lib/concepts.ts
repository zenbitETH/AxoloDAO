import type { Locale } from '@/i18n/strings';

export type ConceptCategory = 'tecnologia' | 'biologia' | 'comportamiento' | 'sistema';
export type ConceptPersona = 'visitante' | 'cripto' | 'biologo' | 'operador';

export interface Concept {
  slug: string;
  category: ConceptCategory;
  personas: ConceptPersona[];
  icon: string;                       // a single emoji
  title: Record<Locale, string>;
  summary: Record<Locale, string>;    // ONE short line per language (max ~90 chars)
  body: Record<Locale, string>;       // 2–4 sentence paragraphs; separate paragraphs with '\n\n'
  refs?: string[];                    // short source/org names, e.g. 'IUCN', 'NOM-059', 'ethereum.org'
}

export const CONCEPTS: Concept[] = [
  // ── Tecnología ────────────────────────────────────────────────────────────
  {
    slug: 'public-goods',
    category: 'tecnologia',
    personas: ['visitante', 'cripto'],
    icon: '🌐',
    title: {
      es: 'Bienes Públicos',
      en: 'Public Goods',
      pt: 'Bens Públicos',
    },
    summary: {
      es: `Recursos que nadie agota ni puede acaparar, como la infraestructura de Ethereum.`,
      en: `Resources no one depletes or can lock up, like Ethereum's infrastructure.`,
      pt: `Recursos que ninguém esgota nem pode monopolizar, como a infraestrutura da Ethereum.`,
    },
    body: {
      es: `Recursos no rivales y no excluibles: su uso por una persona no impide el de otras y no se puede excluir a nadie. La infraestructura de Ethereum —protocolo, clientes, documentación— se trata como un bien público digital sostenido por una comunidad global.`,
      en: `Non-rival and non-excludable resources: one person's use does not reduce availability for others, and no one can be excluded. Ethereum's infrastructure —protocol, clients, documentation— is treated as a digital public good sustained by a global community.`,
      pt: `Recursos não rivais e não excludentes: o uso por uma pessoa não impede o de outras e ninguém pode ser excluído. A infraestrutura da Ethereum —protocolo, clientes, documentação— é tratada como um bem público digital sustentado por uma comunidade global.`,
    },
    refs: ['ethereum.org'],
  },
  {
    slug: 'ethereum',
    category: 'tecnologia',
    personas: ['cripto'],
    icon: '⟠',
    title: {
      es: 'Ethereum',
      en: 'Ethereum',
      pt: 'Ethereum',
    },
    summary: {
      es: `Red descentralizada, activo (ETH) e infraestructura programable de contratos inteligentes.`,
      en: `A decentralized network, an asset (ETH) and programmable smart-contract infrastructure.`,
      pt: `Rede descentralizada, ativo (ETH) e infraestrutura programável de contratos inteligentes.`,
    },
    body: {
      es: `Ethereum tiene tres dimensiones: red descentralizada de nodos, activo nativo (ETH) e infraestructura programable mediante contratos inteligentes. Tras The Merge, su consumo energético se redujo ~99.95% al migrar a Proof of Stake.`,
      en: `Ethereum has three dimensions: a decentralized network of nodes, a native asset (ETH), and programmable infrastructure via smart contracts. Since The Merge, its energy consumption dropped ~99.95% by migrating to Proof of Stake.`,
      pt: `A Ethereum tem três dimensões: uma rede descentralizada de nós, um ativo nativo (ETH) e infraestrutura programável via contratos inteligentes. Desde o Merge, seu consumo energético caiu ~99,95% ao migrar para Proof of Stake.`,
    },
    refs: ['ethereum.org'],
  },
  {
    slug: 'daos',
    category: 'tecnologia',
    personas: ['cripto', 'operador'],
    icon: '🏛️',
    title: {
      es: 'DAOs',
      en: 'DAOs',
      pt: 'DAOs',
    },
    summary: {
      es: `Organizaciones nativas de internet que coordinan personas y recursos sobre Ethereum.`,
      en: `Internet-native organizations coordinating people and resources on Ethereum.`,
      pt: `Organizações nativas da internet que coordenam pessoas e recursos sobre a Ethereum.`,
    },
    body: {
      es: `Organizaciones nativas de internet que coordinan personas, recursos y decisiones sobre Ethereum. AxoloDAO sigue principios de DAOs pequeñas: 7 a 14 miembros y nodos modulares que ejecutan funciones específicas.`,
      en: `Internet-native organizations that coordinate people, resources and decisions on top of Ethereum. AxoloDAO follows small-DAO design principles: 7 to 14 members and modular nodes that execute specific functions.`,
      pt: `Organizações nativas da internet que coordenam pessoas, recursos e decisões sobre a Ethereum. A AxoloDAO segue princípios de DAOs pequenas: 7 a 14 membros e nós modulares que executam funções específicas.`,
    },
  },
  {
    slug: 'microdaos',
    category: 'tecnologia',
    personas: ['cripto', 'operador'],
    icon: '🧩',
    title: {
      es: 'MicroDAOs',
      en: 'MicroDAOs',
      pt: 'MicroDAOs',
    },
    summary: {
      es: `Organización onchain ligera con ENS, Safe y EAS, lista en minutos.`,
      en: `A lightweight onchain organization with ENS, Safe and EAS, ready in minutes.`,
      pt: `Organização onchain leve com ENS, Safe e EAS, pronta em minutos.`,
    },
    body: {
      es: `Puerta de entrada ligera a Ethereum mediante tres primitivas: ENS para identidad, Safe para tesorería multifirma y EAS para atestaciones verificables. Permiten lanzar una organización onchain en minutos, sin reescribir contratos.`,
      en: `A lightweight on-ramp to Ethereum built on three primitives: ENS for identity, Safe for multisig treasury, and EAS for verifiable attestations. They let you launch an onchain organization in minutes without writing custom contracts.`,
      pt: `Uma porta de entrada leve para a Ethereum com três primitivas: ENS para identidade, Safe para tesouraria multisig e EAS para atestações verificáveis. Permitem lançar uma organização onchain em minutos sem escrever contratos.`,
    },
    refs: ['ENS', 'Safe', 'EAS'],
  },

  // ── Biología ──────────────────────────────────────────────────────────────
  {
    slug: 'ajolote',
    category: 'biologia',
    personas: ['visitante', 'biologo'],
    icon: '🦎',
    title: {
      es: 'El ajolote (Ambystoma)',
      en: 'The axolotl (Ambystoma)',
      pt: 'O axolote (Ambystoma)',
    },
    summary: {
      es: `Salamandras del género Ambystoma; A. mexicanum es el ajolote de Xochimilco.`,
      en: `Salamanders of the genus Ambystoma; A. mexicanum is the Xochimilco axolotl.`,
      pt: `Salamandras do gênero Ambystoma; A. mexicanum é o axolote de Xochimilco.`,
    },
    body: {
      es: `El ajolote pertenece al género Ambystoma, un grupo de anfibios conocidos como salamandras topo. Su nombre común cambia según la región —ajolote, axolotl o axolote— y A. mexicanum es el ajolote de Xochimilco, endémico del Valle de México. México es el principal centro de diversidad del género —alberga cerca de la mitad de sus especies— y varias, incluidas las que cuida el Biomuseo, están catalogadas En Peligro Crítico por la IUCN y protegidas por la NOM-059.`,
      en: `The axolotl belongs to the genus Ambystoma, a group of amphibians known as mole salamanders. Its common name changes by region —ajolote, axolotl or axolote— and A. mexicanum is the Xochimilco axolotl, endemic to the Valley of Mexico. Mexico is the genus's main center of diversity —home to about half its species— and several, including those cared for at the Biomuseo, are listed as Critically Endangered by the IUCN and protected under Mexico's NOM-059.`,
      pt: `O axolote pertence ao gênero Ambystoma, um grupo de anfíbios conhecidos como salamandras-topo. Seu nome comum muda conforme a região —ajolote, axolotl ou axolote— e A. mexicanum é o axolote de Xochimilco, endêmico do Vale do México. O México é o principal centro de diversidade do gênero —abriga cerca de metade de suas espécies— e várias, incluindo as cuidadas pelo Biomuseo, estão classificadas como Criticamente Ameaçadas pela IUCN e protegidas pela NOM-059.`,
    },
    refs: ['IUCN', 'NOM-059'],
  },
  {
    slug: 'neotenia',
    category: 'biologia',
    personas: ['visitante', 'biologo'],
    icon: '⏳',
    title: {
      es: 'Neotenia',
      en: 'Neoteny',
      pt: 'Neotenia',
    },
    summary: {
      es: `Conservar branquias y vida acuática y madurar sin metamorfosis.`,
      en: `Keeping gills and an aquatic life, maturing without metamorphosis.`,
      pt: `Conservar brânquias e vida aquática e amadurecer sem metamorfose.`,
    },
    body: {
      es: `La neotenia es la conservación de rasgos larvarios —branquias externas plumosas y vida acuática— en la edad adulta. El ajolote alcanza la madurez sexual sin metamorfosear, a diferencia de otras salamandras que dejan el agua de adultas. Este rasgo, regulado por el eje hormonal tiroideo, es característico de los ajolotes neoténicos como A. mexicanum, no de todo el género, y suele asociarse con su notable capacidad de regeneración.`,
      en: `Neoteny is the retention of larval traits —feathery external gills and an aquatic life— into adulthood. The axolotl reaches sexual maturity without metamorphosing, unlike other salamanders that leave the water as adults. Governed by thyroid-hormone signaling, this trait is characteristic of neotenic axolotls such as A. mexicanum —not of the whole genus— and is often linked to its remarkable capacity for regeneration.`,
      pt: `A neotenia é a conservação de traços larvais —brânquias externas plumosas e vida aquática— na idade adulta. O axolote atinge a maturidade sexual sem metamorfosear, ao contrário de outras salamandras que deixam a água quando adultas. Regulado pelo eixo hormonal tireoidiano, esse traço é característico dos axolotes neotênicos como A. mexicanum, não de todo o gênero, e costuma estar associado à sua notável capacidade de regeneração.`,
    },
  },
  {
    slug: 'regeneracion',
    category: 'biologia',
    personas: ['visitante', 'biologo'],
    icon: '🌱',
    title: {
      es: 'Regeneración',
      en: 'Regeneration',
      pt: 'Regeneração',
    },
    summary: {
      es: `Reconstruir extremidades y tejidos sin cicatriz mediante el blastema.`,
      en: `Rebuilding limbs and tissues without scarring, via the blastema.`,
      pt: `Reconstruir membros e tecidos sem cicatriz por meio do blastema.`,
    },
    body: {
      es: `El ajolote puede regenerar extremidades, partes del corazón y otros tejidos sin dejar cicatriz. Tras una lesión, las células cercanas a la herida revierten parte de su especialización hacia un estado similar al de las células madre y forman una masa no diferenciada —el blastema— que reconstruye la estructura perdida. La ciencia estudia estos mecanismos como modelo biológico, pero aún no se traducen en terapias para humanos.`,
      en: `The axolotl can regrow limbs, parts of its heart and other tissues without scarring. After an injury, cells near the wound reverse part of their specialization toward a stem-cell-like state and form an undifferentiated mass —the blastema— that rebuilds the lost structure. Researchers study these mechanisms as a biological model, but they have not yet translated into therapies for humans.`,
      pt: `O axolote consegue regenerar membros, partes do coração e outros tecidos sem deixar cicatriz. Após uma lesão, as células próximas ao ferimento revertem parte de sua especialização a um estado semelhante ao das células-tronco e formam uma massa indiferenciada —o blastema— que reconstrói a estrutura perdida. A ciência estuda esses mecanismos como modelo biológico, mas eles ainda não se traduzem em terapias para humanos.`,
    },
  },
  {
    slug: 'ciclo-nitrogeno',
    category: 'biologia',
    personas: ['biologo', 'operador'],
    icon: '💧',
    title: {
      es: 'Ciclo del nitrógeno',
      en: 'Nitrogen cycle',
      pt: 'Ciclo do nitrogênio',
    },
    summary: {
      es: `Amoníaco → nitritos → nitratos: cómo las bacterias depuran el agua.`,
      en: `Ammonia → nitrite → nitrate: how bacteria keep the water safe.`,
      pt: `Amônia → nitrito → nitrato: como as bactérias mantêm a água segura.`,
    },
    body: {
      es: `En una pecera, los desechos de los ajolotes liberan amoníaco (NH₃), que es tóxico. Bacterias nitrificantes lo transforman primero en nitritos (NO₂), también tóxicos, y luego en nitratos (NO₃), mucho menos dañinos. Mantener este ciclo estable es clave para la salud de los ejemplares: el Biomuseo busca amoníaco y nitritos cercanos a cero y vigila los nitratos en cada prueba semanal.`,
      en: `In an aquarium, axolotl waste releases ammonia (NH₃), which is toxic. Nitrifying bacteria convert it first into nitrite (NO₂), also toxic, and then into nitrate (NO₃), far less harmful. Keeping this cycle stable is essential to specimen health: the Biomuseo aims for ammonia and nitrite near zero and tracks nitrate in every weekly test.`,
      pt: `Em um aquário, os resíduos dos axolotes liberam amônia (NH₃), que é tóxica. Bactérias nitrificantes a convertem primeiro em nitrito (NO₂), também tóxico, e depois em nitrato (NO₃), bem menos nocivo. Manter esse ciclo estável é essencial para a saúde dos exemplares: o Biomuseo busca amônia e nitrito perto de zero e acompanha o nitrato em cada teste semanal.`,
    },
  },

  // ── Comportamiento ────────────────────────────────────────────────────────
  {
    slug: 'etograma',
    category: 'comportamiento',
    personas: ['visitante', 'biologo', 'operador'],
    icon: '📋',
    title: {
      es: 'Etograma',
      en: 'Ethogram',
      pt: 'Etograma',
    },
    summary: {
      es: `Catálogo de comportamientos distintos para estudiar a la especie.`,
      en: `A catalogue of distinct behaviors for studying a species.`,
      pt: `Catálogo de comportamentos distintos para estudar a espécie.`,
    },
    body: {
      es: `Un etograma es el catálogo de los comportamientos distintos de una especie, la base para estudiarla de forma sistemática. AxoloDAO documenta la conducta del ajolote en un catálogo abierto que hoy reúne 37 comportamientos organizados en seis categorías, desde la respiración hasta el cortejo y las señales de salud. Registrar cada conducta permite detectar a tiempo cambios en el bienestar de los ejemplares.`,
      en: `An ethogram is the catalogue of an animal's distinct behaviors —the basis for studying a species systematically. AxoloDAO documents axolotl behavior in an open catalogue that currently holds 37 behaviors across six categories, from breathing to courtship and health signals. Recording each behavior helps spot changes in a specimen's wellbeing early.`,
      pt: `Um etograma é o catálogo dos comportamentos distintos de uma espécie, a base para estudá-la de forma sistemática. A AxoloDAO documenta o comportamento do axolote em um catálogo aberto que hoje reúne 37 comportamentos organizados em seis categorias, da respiração ao cortejo e aos sinais de saúde. Registrar cada conduta ajuda a detectar cedo mudanças no bem-estar dos exemplares.`,
    },
    refs: ['Xovi'],
  },
  {
    slug: 'respuesta-alimentaria',
    category: 'comportamiento',
    personas: ['biologo', 'operador'],
    icon: '🍤',
    title: {
      es: 'Respuesta alimentaria',
      en: 'Feeding response',
      pt: 'Resposta alimentar',
    },
    summary: {
      es: `Cómo reacciona un ejemplar ante la comida: señal temprana de salud.`,
      en: `How a specimen reacts to food: an early health signal.`,
      pt: `Como um exemplar reage ao alimento: sinal precoce de saúde.`,
    },
    body: {
      es: `La respuesta alimentaria describe cómo reacciona un ejemplar cuando se le ofrece comida: si la persigue, la acepta o la rechaza. Es uno de los indicadores conductuales más sensibles de su estado de salud, junto con la condición corporal (BCS, escala visual 1–5). El Biomuseo registra el alimento ofrecido y consumido de cada ajolote, de modo que una caída en la respuesta alimentaria alerta de un posible problema antes que otros signos.`,
      en: `Feeding response describes how a specimen reacts when offered food —whether it chases, accepts or refuses it. It is one of the most sensitive behavioral indicators of health, alongside body condition (BCS, a 1–5 visual scale). The Biomuseo logs the food offered and eaten by each axolotl, so a drop in feeding response flags a possible problem before other signs appear.`,
      pt: `A resposta alimentar descreve como um exemplar reage quando lhe é oferecido alimento —se o persegue, aceita ou recusa. É um dos indicadores comportamentais mais sensíveis do estado de saúde, junto com a condição corporal (BCS, escala visual 1–5). O Biomuseo registra o alimento oferecido e consumido por cada axolote, de modo que uma queda na resposta alimentar sinaliza um possível problema antes de outros sinais.`,
    },
  },

  // ── Sistema AxoloDAO ──────────────────────────────────────────────────────
  {
    slug: 'nodos-ens',
    category: 'sistema',
    personas: ['cripto', 'operador'],
    icon: '🔗',
    title: {
      es: 'Nodos y ENS',
      en: 'Nodes & ENS',
      pt: 'Nós e ENS',
    },
    summary: {
      es: `Nodos onchain con identidad ENS bajo axolodao.eth.`,
      en: `Onchain nodes with ENS identities under axolodao.eth.`,
      pt: `Nós onchain com identidade ENS sob axolodao.eth.`,
    },
    body: {
      es: `AxoloDAO se organiza como un conjunto de nodos onchain, cada uno con identidad propia mediante un subnombre ENS bajo axolodao.eth. Así, treasury.axolodao.eth es la tesorería, zenbit.axolodao.eth la infraestructura digital, xolotlcalli.axolodao.eth la conservación y ndali.axolodao.eth la articulación comunitaria. Los subnombres ENS dan a cada nodo y a cada participante una identidad verificable y legible en toda la red.`,
      en: `AxoloDAO is organized as a set of onchain nodes, each with its own identity through an ENS subname under axolodao.eth. So treasury.axolodao.eth is the treasury, zenbit.axolodao.eth the digital infrastructure, xolotlcalli.axolodao.eth conservation, and ndali.axolodao.eth community articulation. ENS subnames give each node and member a verifiable, human-readable identity across the network.`,
      pt: `A AxoloDAO se organiza como um conjunto de nós onchain, cada um com identidade própria por meio de um subnome ENS sob axolodao.eth. Assim, treasury.axolodao.eth é a tesouraria, zenbit.axolodao.eth a infraestrutura digital, xolotlcalli.axolodao.eth a conservação e ndali.axolodao.eth a articulação comunitária. Os subnomes ENS dão a cada nó e participante uma identidade verificável e legível em toda a rede.`,
    },
    refs: ['ENS'],
  },
  {
    slug: 'peceras',
    category: 'sistema',
    personas: ['operador', 'visitante'],
    icon: '🏷️',
    title: {
      es: 'Nomenclatura de peceras',
      en: 'Tank naming',
      pt: 'Nomenclatura dos aquários',
    },
    summary: {
      es: `Códigos por especie: AA, AM (sistema AM1–AM4), AD y Cuarentena.`,
      en: `Species codes: AA, AM (the AM1–AM4 system), AD and quarantine.`,
      pt: `Códigos por espécie: AA, AM (sistema AM1–AM4), AD e quarentena.`,
    },
    body: {
      es: `Cada pecera del Biomuseo lleva un código según la especie que aloja: AA para A. andersoni, AM para A. mexicanum y AD para A. dumerilii. La estación AM es un único sistema de agua recirculante formado por cuatro acuarios (AM1 a AM4), que comparten la misma medición de calidad del agua. Existe además una pecera de Cuarentena, donde un ejemplar enfermo se aísla temporalmente fuera de su estación de origen.`,
      en: `Each Biomuseo tank carries a code based on the species it houses: AA for A. andersoni, AM for A. mexicanum and AD for A. dumerilii. The AM station is a single recirculating water system made of four aquariums (AM1 to AM4) that share one water-quality reading. There is also a Cuarentena (quarantine) tank, where a sick specimen is isolated temporarily away from its home station.`,
      pt: `Cada aquário do Biomuseo recebe um código conforme a espécie que abriga: AA para A. andersoni, AM para A. mexicanum e AD para A. dumerilii. A estação AM é um único sistema de água recirculante formado por quatro aquários (AM1 a AM4), que compartilham a mesma medição de qualidade da água. Há ainda um aquário de Cuarentena (quarentena), onde um exemplar doente é isolado temporariamente fora de sua estação de origem.`,
    },
  },
  {
    slug: 'custodia-bajas',
    category: 'sistema',
    personas: ['operador', 'visitante'],
    icon: '🛡️',
    title: {
      es: 'Custodia y bajas',
      en: 'Custody & losses',
      pt: 'Custódia e baixas',
    },
    summary: {
      es: `Cuidar ejemplares con registro abierto; honrar las bajas in memoriam.`,
      en: `Caring for specimens on an open registry; honoring losses in memoriam.`,
      pt: `Cuidar exemplares com registro aberto; honrar as baixas in memoriam.`,
    },
    body: {
      es: `Custodia significa que el Biomuseo resguarda y cuida a cada ejemplar, manteniendo un registro público y abierto con su biometría, historial médico y plan de alimentación. Cuando un ejemplar deja la colección activa —por fallecimiento, traslado o liberación— se registra como una baja. Las bajas por fallecimiento no se ocultan: se conservan «in memoriam», con su última biometría y la causa probable, como parte del compromiso de transparencia.`,
      en: `Custody means the Biomuseo holds and cares for each specimen, keeping an open, public registry with its biometry, medical history and feeding plan. When a specimen leaves the active collection —through death, transfer or release— it is recorded as a baja (loss). Losses by death are not hidden: they are kept "in memoriam", with the specimen's last biometry and probable cause, as part of the commitment to transparency.`,
      pt: `Custódia significa que o Biomuseo guarda e cuida de cada exemplar, mantendo um registro público e aberto com sua biometria, histórico médico e plano alimentar. Quando um exemplar deixa a coleção ativa —por falecimento, transferência ou soltura— é registrado como uma baixa. As baixas por falecimento não são ocultadas: são mantidas "in memoriam", com a última biometria e a causa provável, como parte do compromisso de transparência.`,
    },
  },
  {
    slug: 'xovi',
    category: 'sistema',
    personas: ['visitante', 'cripto', 'operador'],
    icon: '📹',
    title: {
      es: 'Xovi (AxoloVision)',
      en: 'Xovi (AxoloVision)',
      pt: 'Xovi (AxoloVision)',
    },
    summary: {
      es: `App de transmisión y visión por computadora para observar a los ajolotes.`,
      en: `A livestream and computer-vision app to watch over the axolotls.`,
      pt: `App de transmissão e visão computacional para observar os axolotes.`,
    },
    body: {
      es: `Xovi (antes AxoloVision) es la capa de participación de AxoloDAO sobre la transmisión en vivo del Biomuseo Xolotlcalli. Quienes observan pueden detectar comportamientos de los ajolotes y enviarlos como clips; tras la validación de la comunidad, cada contribución puede quedar registrada en Ethereum mediante atestaciones EAS. Los miembros inician sesión con su cuenta de Ethereum (SIWE, «Sign in with Ethereum»). El proyecto está en desarrollo activo.`,
      en: `Xovi (formerly AxoloVision) is AxoloDAO's participation layer over the Xolotlcalli Biomuseo livestream. Viewers can spot axolotl behaviors and submit them as clips; after community validation, each contribution can be recorded on Ethereum through EAS attestations. Members sign in with their Ethereum account (SIWE, "Sign in with Ethereum"). The project is in active development.`,
      pt: `Xovi (antes AxoloVision) é a camada de participação da AxoloDAO sobre a transmissão ao vivo do Biomuseo Xolotlcalli. Quem assiste pode detectar comportamentos dos axolotes e enviá-los como clipes; após a validação da comunidade, cada contribuição pode ser registrada na Ethereum por meio de atestações EAS. Os membros entram com sua conta Ethereum (SIWE, "Sign in with Ethereum"). O projeto está em desenvolvimento ativo.`,
    },
    refs: ['SIWE', 'EAS'],
  },
];
