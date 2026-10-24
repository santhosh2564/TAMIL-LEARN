import fs from 'node:fs';
import path from 'node:path';

interface ImageRecord {
  file: string;
  words: string;
  visible_watermark: string;
  shows_word: string; // 'yes' | 'partly' | 'no'
  suitable_for_class_3: string; // 'yes' | 'no'
  reason: string;
}

const failedRecords: ImageRecord[] = [
  // --- English Images ---
  {
    file: 'public/assets/class-3/english/images/eng-aval.jpg',
    words: 'aval',
    visible_watermark: 'yes (Adobe Stock | #144959283)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Adobe Stock watermark pattern and asset ID visible across and along margin of image'
  },
  {
    file: 'public/assets/class-3/english/images/eng-bat.jpg',
    words: 'bat',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Wide action photo of a cricket match; players and pitch dominate, bat is tiny and unclear for Class 3"
  },
  {
    file: 'public/assets/class-3/english/images/eng-beak.jpg',
    words: 'beak',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Complex anatomical diagram titled 'ANATOMY OF A BIRD BEAK' with dense scientific labels"
  },
  {
    file: 'public/assets/class-3/english/images/eng-bengal-gram.jpg',
    words: 'bengal gram',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows a Bengal cat instead of bengal gram (chickpea pulse)'
  },
  {
    file: 'public/assets/class-3/english/images/eng-big.jpg',
    words: 'big',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Shows the CopenHill industrial power plant building; abstract concept and confusing for Class 3"
  },
  {
    file: 'public/assets/class-3/english/images/eng-black-gram.jpg',
    words: 'black gram',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Corrupted solid black rectangle image'
  },
  {
    file: 'public/assets/class-3/english/images/eng-bolt.jpg',
    words: 'bolt',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Educational chart titled 'Types of Metals' showing material samples instead of a bolt"
  },
  {
    file: 'public/assets/class-3/english/images/eng-bow.jpg',
    words: 'bow',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Multi-step DIY crafting tutorial collage titled 'Make an Easy Double Bow' with text"
  },
  {
    file: 'public/assets/class-3/english/images/eng-boy.jpg',
    words: 'boy',
    visible_watermark: 'yes (stock banner)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Stock agency banner watermark visible along bottom edge'
  },
  {
    file: 'public/assets/class-3/english/images/eng-brown.jpg',
    words: 'brown',
    visible_watermark: 'yes (CreativeBooster.net)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Color swatch palette chart titled '100+ SHADES OF BROWN' with hex codes"
  },
  {
    file: 'public/assets/class-3/english/images/eng-coil.jpg',
    words: 'coil',
    visible_watermark: 'yes (IQSdirectory.com)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Commercial logo and watermark for IQSdirectory.com visible in bottom corner'
  },
  {
    file: 'public/assets/class-3/english/images/eng-cold.jpg',
    words: 'cold',
    visible_watermark: 'yes (Dreamstime)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Dreamstime watermark logo and text visible in bottom corner'
  },
  {
    file: 'public/assets/class-3/english/images/eng-cop.jpg',
    words: 'cop',
    visible_watermark: 'yes (Adobe Stock | #710153795)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Adobe Stock watermark pattern and asset ID along left margin'
  },
  {
    file: 'public/assets/class-3/english/images/eng-cradle.jpg',
    words: 'cradle',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows hands holding a swaddled infant; no cradle shown'
  },
  {
    file: 'public/assets/class-3/english/images/eng-curry-leaves.jpg',
    words: 'curry leaves',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows a cooked plate of chicken curry and rice rather than curry leaves'
  },
  {
    file: 'public/assets/class-3/english/images/eng-dad.jpg',
    words: 'dad',
    visible_watermark: 'yes (VectorStock)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'VectorStock attribution banner watermark along bottom edge'
  },
  {
    file: 'public/assets/class-3/english/images/eng-den.jpg',
    words: 'den',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Shows bare soil ground with a small hole; ambiguous and unclear as an animal den'
  },
  {
    file: 'public/assets/class-3/english/images/eng-ear.jpg',
    words: 'ear',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Medical cross-section diagram of ear anatomy showing eardrum, ossicles, and cochlea with labels'
  },
  {
    file: 'public/assets/class-3/english/images/eng-eye.jpg',
    words: 'eye',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Medical anatomical diagram titled 'EYE ANATOMY' with clinical eyeball dissection callouts"
  },
  {
    file: 'public/assets/class-3/english/images/eng-finger.jpg',
    words: 'finger',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Medical 3D skeleton x-ray diagram titled 'Bones of hand' (Phalanges, Metacarpals)"
  },
  {
    file: 'public/assets/class-3/english/images/eng-fingers.jpg',
    words: 'fingers',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Identical medical skeleton x-ray diagram titled 'Bones of hand'"
  },
  {
    file: 'public/assets/class-3/english/images/eng-gem.jpg',
    words: 'gem',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Educational chart titled 'LIST OF GREEN GEMSTONES' with individual mineral specimen labels"
  },
  {
    file: 'public/assets/class-3/english/images/eng-hat.jpg',
    words: 'hat',
    visible_watermark: 'yes (Dreamstime)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Dreamstime watermark grid pattern visible across the beanie'
  },
  {
    file: 'public/assets/class-3/english/images/eng-he.jpg',
    words: 'he',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Grammar textbook chart showing pronouns ('he, she, it, you, we, they')"
  },
  {
    file: 'public/assets/class-3/english/images/eng-heads.jpg',
    words: 'heads',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Abstract CGI colored mannequin busts; confusing representation for Class 3'
  },
  {
    file: 'public/assets/class-3/english/images/eng-hop.jpg',
    words: 'hop',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Shows a smiling child's face; does not show hopping or movement"
  },
  {
    file: 'public/assets/class-3/english/images/eng-insects.jpg',
    words: 'insects',
    visible_watermark: 'yes (Encyclopædia Britannica)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: "Scientific taxonomy poster with Latin names and '© 2012 Encyclopædia Britannica, Inc.' copyright notice"
  },
  {
    file: 'public/assets/class-3/english/images/eng-kid.jpg',
    words: 'kid',
    visible_watermark: 'yes (Getty Images)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: "Prominent 'gettyimages - Credit: FatCamera' watermark overlay in bottom right corner"
  },
  {
    file: 'public/assets/class-3/english/images/eng-laddus.jpg',
    words: 'laddus',
    visible_watermark: 'yes (Dreamstime)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Dreamstime watermark URL and credit banner along bottom edge'
  },
  {
    file: 'public/assets/class-3/english/images/eng-leg.jpg',
    words: 'leg',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Medical anatomical dissection chart showing musculature with Latin labels (Gluteus, Biceps Femoris)'
  },
  {
    file: 'public/assets/class-3/english/images/eng-lift.jpg',
    words: 'lift',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Portrait of a young boy's head; does not show an elevator or the action of lifting"
  },
  {
    file: 'public/assets/class-3/english/images/eng-lunch.jpg',
    words: 'lunch',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Exterior architectural photograph of a commercial building; does not show lunch or food'
  },
  {
    file: 'public/assets/class-3/english/images/eng-man.jpg',
    words: 'man',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark logos in bottom left and top left corners'
  },
  {
    file: 'public/assets/class-3/english/images/eng-map.jpg',
    words: 'map',
    visible_watermark: 'yes (Shutterstock)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: "Shutterstock watermark and ID 'shutterstock.com • 2279678669' at bottom"
  },
  {
    file: 'public/assets/class-3/english/images/eng-match.jpg',
    words: 'match',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark logo visible on side of matchbox'
  },
  {
    file: 'public/assets/class-3/english/images/eng-mom.jpg',
    words: 'mom',
    visible_watermark: 'yes (CBS sitcom logo)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Promotional poster for adult CBS television sitcom 'Mom' with network logo; unsuitable for Class 3"
  },
  {
    file: 'public/assets/class-3/english/images/eng-mouth.jpg',
    words: 'mouth',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Medical anatomical chart titled 'Mouth (Oral Cavity)' with clinical callouts (Uvula, Palatine tonsil)"
  },
  {
    file: 'public/assets/class-3/english/images/eng-mud.jpg',
    words: 'mud',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark bar in bottom left corner'
  },
  {
    file: 'public/assets/class-3/english/images/eng-neck.jpg',
    words: 'neck',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Medical cervical spine dissection diagram showing exposed vertebrae with Alamy watermark'
  },
  {
    file: 'public/assets/class-3/english/images/eng-nut.jpg',
    words: 'nut',
    visible_watermark: 'yes (Dreamstime)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Dreamstime watermark URL banner visible along bottom margin'
  },
  {
    file: 'public/assets/class-3/english/images/eng-pinky.jpg',
    words: 'pinky',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Medical tendon anatomy diagram of hand and fingers with clinical thumbnails'
  },
  {
    file: 'public/assets/class-3/english/images/eng-red.jpg',
    words: 'red',
    visible_watermark: 'yes (CreativeBooster.net)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Color swatch chart titled '100+ SHADES OF RED - CREATIVEBOOSTER.NET' with hex codes"
  },
  {
    file: 'public/assets/class-3/english/images/eng-rest.jpg',
    words: 'rest',
    visible_watermark: 'yes (Dreamstime)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Dreamstime watermark text repeating across the center of the illustration'
  },
  {
    file: 'public/assets/class-3/english/images/eng-ring.jpg',
    words: 'ring',
    visible_watermark: 'yes (Adobe Stock | #64103812)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Adobe Stock watermark pattern across image and license ID along left margin'
  },
  {
    file: 'public/assets/class-3/english/images/eng-seasons.jpg',
    words: 'seasons',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark visible in bottom left corner and center'
  },
  {
    file: 'public/assets/class-3/english/images/eng-seat.jpg',
    words: 'seat',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows a red SEAT-brand automobile driving on a road instead of a seat or chair'
  },
  {
    file: 'public/assets/class-3/english/images/eng-shadow.jpg',
    words: 'shadow',
    visible_watermark: 'yes (Sonic character logo)',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Shows Sega video game character 'Shadow the Hedgehog' with 'SONIC THE HEDGEHOG' logo instead of a shadow"
  },
  {
    file: 'public/assets/class-3/english/images/eng-she.jpg',
    words: 'she',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Grammar textbook exercise graphic with prominent text 'SHE - HE - SHE'S GOT... HE'S GOT...'"
  },
  {
    file: 'public/assets/class-3/english/images/eng-shells.jpg',
    words: 'shells',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows open sea and horizon; no seashells are visible'
  },
  {
    file: 'public/assets/class-3/english/images/eng-shovel.jpg',
    words: 'shovel',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows landscaped garden with patio chairs and flowerbeds; no shovel visible'
  },
  {
    file: 'public/assets/class-3/english/images/eng-sit.jpg',
    words: 'sit',
    visible_watermark: 'yes (stock watermark bar)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Stock photo agency watermark bar along bottom edge'
  },
  {
    file: 'public/assets/class-3/english/images/eng-swim.jpg',
    words: 'swim',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Screenshot of 'Hydra' IT virtual desktop monitoring dashboard with system load graphs; no swimming"
  },
  {
    file: 'public/assets/class-3/english/images/eng-tap.jpg',
    words: 'tap',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark banner across bottom of image'
  },
  {
    file: 'public/assets/class-3/english/images/eng-tender-coconut.jpg',
    words: 'tender coconut',
    visible_watermark: 'yes (Heart Dream logo)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Commercial watermark/logo in top right corner'
  },
  {
    file: 'public/assets/class-3/english/images/eng-thank-you.jpg',
    words: 'thank you',
    visible_watermark: 'yes (Shutterstock)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Shutterstock watermark bar underneath the character'
  },
  {
    file: 'public/assets/class-3/english/images/eng-toe.jpg',
    words: 'toe',
    visible_watermark: 'yes (Alamy)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Alamy watermark pattern across foot and logo in bottom corner'
  },
  {
    file: 'public/assets/class-3/english/images/eng-tool.jpg',
    words: 'tool',
    visible_watermark: 'yes (TOOL band photo/logo)',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Promotional band photograph of American rock group TOOL instead of hand tools'
  },
  {
    file: 'public/assets/class-3/english/images/eng-town.jpg',
    words: 'town',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: 'Shows a wooden indoor dining table and chairs; does not show a town'
  },
  {
    file: 'public/assets/class-3/english/images/eng-train.jpg',
    words: 'train',
    visible_watermark: 'yes (stock watermark)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: 'Vertical stock agency watermark text along left margin'
  },
  {
    file: 'public/assets/class-3/english/images/eng-truck.jpg',
    words: 'truck',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Promotional poster for anime series 'D4DJ All Mix'; does not show a truck"
  },
  {
    file: 'public/assets/class-3/english/images/eng-web.jpg',
    words: 'web',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Abstract internet telecommunication network topology map instead of a spider web'
  },
  {
    file: 'public/assets/class-3/english/images/eng-wings.jpg',
    words: 'wings',
    visible_watermark: 'yes (YouTube video title banner)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "YouTube video thumbnail overlay with large bold title banner 'AMAZING BIRDS! HOW DO THEY FLY?'"
  },
  {
    file: 'public/assets/class-3/english/images/eng-wish.jpg',
    words: 'wish',
    visible_watermark: 'yes (Disney movie poster)',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Promotional poster for Disney animated feature film 'WISH' with studio logo"
  },

  // --- Tamil Images ---
  {
    file: 'public/assets/class-3/tamil/images/FTS0013.jpg',
    words: 'அட்டை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Shows an adult silkmoth (Bombyx); Class 3 Tamil 'அட்டை' means leech or cardboard, not a moth"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0072.jpg',
    words: 'ஆடையகம்',
    visible_watermark: 'yes (Redmi Note 10 Pro camera watermark)',
    shows_word: 'yes',
    suitable_for_class_3: 'no',
    reason: "Camera brand and timestamp watermark 'REDMI NOTE 10 PRO - 2021.12.11 14:02' in bottom left"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0096.jpg',
    words: 'இனிப்பகம்',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: 'Antique Japanese monochrome woodblock print with Japanese calligraphy; not recognizable as a sweet shop for Class 3'
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0127.jpg',
    words: 'உடம்பு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Passport headshot facial morphing study; shows only faces, does not show a human body ('உடம்பு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0128.jpg',
    words: 'உடல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Identical passport headshots showing only faces; does not show a human body ('உடல்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0147.jpg',
    words: 'உருண்டை',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Snow polo action photo with horse and rider; the tiny orange ball ('உருண்டை') is an obscure tiny dot"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0164.jpg',
    words: 'ஊதல்',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Shows a woman blowing her runny nose into a tissue; Class 3 Tamil 'ஊதல்' means a whistle or blowing a horn"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0177.jpg',
    words: 'எண்ணெய்',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Satellite photograph of an ocean oil slick; appears as abstract swirls/clouds, confusing representation for Class 3 'எண்ணெய்' (oil)"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0248.jpg',
    words: 'கரம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Broken antique marble relic/statue fragment; completely unrecognizable as a human hand ('கரம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0305.jpg',
    words: 'கீற்று',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Ophthalmic slit lamp examination microscope; in Class 3 Tamil 'கீற்று' refers to coconut thatch / palm frond leaf"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0323.jpg',
    words: 'குரல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Four disassembled USB circuit boards; completely unrelated to voice ('குரல்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0325.jpg',
    words: 'குறிப்பு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "18th-century astrological chart titled 'The Nativity of a dumb Lunatic and Idiot'; inappropriate content"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0339.jpg',
    words: 'குழி',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "EHT astronomical photograph of the M87 supermassive black hole; too abstract for Class 3 learning hole/pit ('குழி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0345.jpg',
    words: 'கேணி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Commercial landscaped stream/pond beside a parking lot; not a water well ('கேணி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0352.jpg',
    words: 'கொக்கு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Industrial crane pulley and chains; in Tamil 'கொக்கு' is the egret/crane bird, not construction machinery"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0353.jpg',
    words: 'கொசு',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Pinned museum insect specimens with taxonomy label tags ('Culicidae'); does not clearly show a mosquito"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0357.jpg',
    words: 'கொம்பு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Two human wrists with 'love' and 'eros' tattoos; completely unrelated to animal horn or tree branch ('கொம்பு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0361.jpg',
    words: 'கோடை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Botanical plate of an Aquilegia flower with German caption; does not depict summer ('கோடை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0365.jpg',
    words: 'கோலிகுண்டு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "NASA 'Blue Marble' space photograph of planet Earth instead of a children's playing marble ('கோலிகுண்டு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0385.jpg',
    words: 'சறுக்கு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Smartphone screenshot of an Instagram/TikTok live broadcast; not a slide ('சறுக்கு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0386.jpg',
    words: 'சறுக்குப்பலகை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Hillside landscape pasture with sheep; no sliding board ('சறுக்குப்பலகை') is visible"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0406.jpg',
    words: 'சிரம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Eerie stone face mask tucked into a hollow tree trunk; bizarre representation for head ('சிரம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0410.jpg',
    words: 'சிறகு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Full mounted skeleton of a bird; scary skeletal bone exhibit instead of a wing/feather ('சிறகு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0419.jpg',
    words: 'சீப்பு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Ethnographic tribal woven fiber artifact with tassels; not a comb ('சீப்பு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0452.jpg',
    words: 'செல்வர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "White pickup truck parked on pavement; does not depict a wealthy person ('செல்வர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0490.jpg',
    words: 'தம்பி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Classical museum sculpture of a nude male displaying bare buttocks from behind; inappropriate for Class 3"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0503.jpg',
    words: 'தழும்பு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Surveyor benchmark arrow carved into stone masonry wall; not a physical body scar ('தழும்பு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0511.jpg',
    words: 'தார்ச்சாலை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Unpaved dirt country trail; does not show a paved tar road ('தார்ச்சாலை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0540.jpg',
    words: 'துருவி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Industrial mechanical worm drive auger screw; Tamil 'துருவி' is a coconut scraper/grater"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0551.jpg',
    words: 'தேங்காய்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "A giant coconut crab (Birgus latro); scary crustacean instead of a coconut fruit ('தேங்காய்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0579.jpg',
    words: 'தோட்டம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Aerial view of archaeological foundation ruins in a field; does not show a garden ('தோட்டம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0590.jpg',
    words: 'நட்டு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Park bench covered in ivy; does not show a hardware nut/fastener ('நட்டு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0612.jpg',
    words: 'நாள்காட்டி',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "English event pamphlet cover for '2012 Minority Health Month Calendar of Events'; not a clear calendar"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0613.jpg',
    words: 'நாவல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Soldier looking into an acoustic aircraft listening horn; unrelated to novel book or jambul fruit ('நாவல்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0620.jpg',
    words: 'நிலம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Bright neon yellow nudibranch sea slug on underwater coral reef; does not show land or ground ('நிலம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0629.png',
    words: 'நீதிபதி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "County map of Missouri judicial circuits; does not show a judge ('நீதிபதி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0657.png',
    words: 'பகைவர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Scanned page of a typed declassified intelligence report; does not show an enemy ('பகைவர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0683.jpg',
    words: 'பத்திரம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Empty walled concrete patio; does not depict a legal document or deed ('பத்திரம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0685.jpg',
    words: 'பந்து',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Snow polo action photo; the polo ball ('பந்து') is an indistinguishable tiny speck"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0689.jpg',
    words: 'பயந்து',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Close-up of a menacing venomous viper snake; dangerous reptile rather than portraying fear ('பயந்து')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0699.jpg',
    words: 'பரிசு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Vintage 'Ladies' Home Journal' magazine cover; unrelated to a gift or prize ('பரிசு')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0709.jpg',
    words: 'பலா',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "People inside a souvenir and tapestry shop; does not show a jackfruit ('பலா')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0732.jpg',
    words: 'பானை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "17th-century European canal landscape painting; does not show a pot ('பானை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0735.jpg',
    words: 'பாயசம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Open blank pages of an antique empty ledger book; does not show payasam sweet pudding ('பாயசம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0744.jpg',
    words: 'பால்',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Cheese curds/powder draining in cheesecloth; ambiguous and does not show clear milk ('பால்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0757.jpg',
    words: 'புகைப்படம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Naval warship superstructure and turret; does not show or represent a photograph ('புகைப்படம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0776.jpg',
    words: 'பூங்கொத்து',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Maize tassel flowering on a corn stalk; not a flower bouquet ('பூங்கொத்து')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0780.jpg',
    words: 'பூட்டு',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Painting of a canal lock construction basin; in Tamil 'பூட்டு' is a padlock/door lock, not a canal lock"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0784.png',
    words: 'பெட்டிகள்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Abstract pink fluid splash on black background; does not show boxes ('பெட்டிகள்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0786.jpg',
    words: 'பென்சில்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Monochrome sketch of a dead tree in a field; does not show a pencil ('பென்சில்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0796.jpg',
    words: 'பெற்றோர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Technical engineering blueprint of a boat hull; unrelated to parents ('பெற்றோர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0798.jpg',
    words: 'பேனா',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Landscape drawing of rocky sea cliffs; does not show a pen ('பேனா')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0806.jpg',
    words: 'பொம்மை',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Exterior building facade of a Children's Museum; does not show a doll or toy ('பொம்மை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0815.jpg',
    words: 'போர்வை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Street with brick commercial storefronts; does not show a blanket ('போர்வை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0857.jpg',
    words: 'மாணவர்கள்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Single adult businessman in a suit; does not show students (plural) ('மாணவர்கள்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0861.jpg',
    words: 'மாமா',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Antique carved Greek baptismal font with inscription; unrelated to maternal uncle ('மாமா')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0870.jpg',
    words: 'மின்விசிறி',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Ornamental paper hand fan rosette; does not show an electric fan ('மின்விசிறி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0874.jpg',
    words: 'முகமூடி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Clothing shop mannequins without masks; does not show a mask ('முகமூடி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0880.jpg',
    words: 'முதலை',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Fossilized crocodile skull with menacing teeth; bare skeletal bone head inappropriate for Class 3"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0909.jpg',
    words: 'மேடை',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Carved wooden totem statue exhibited on a museum pedestal; does not represent a stage ('மேடை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0916.jpg',
    words: 'மைக்குப்பி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Row of London brick terrace houses; does not show an ink bottle ('மைக்குப்பி')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0917.jpg',
    words: 'மைதானம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Ancient Aztec / Mesoamerican painted historical codex manuscript; does not show a sports playground ('மைதானம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0926.jpg',
    words: 'ரப்பர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Geographic distribution map of South America highlighting the Amazon basin; does not show rubber ('ரப்பர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0927.jpg',
    words: 'ரயில்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Park grass with distant elevated highway / rail overpass; no train is visible"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0930.jpg',
    words: 'வகுப்பறை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Informational poster boards leaning against a wall in a hallway; does not show a classroom ('வகுப்பறை')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0937.png',
    words: 'வணிகர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Screenshot of Windows Calculator software application; does not show a merchant/trader ('வணிகர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0940.jpg',
    words: 'வண்ணமிடப்பட்ட',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Naval warship launching a guided missile with smoke over the ocean; completely unsuitable representation for 'colored/painted' ('வண்ணமிடப்பட்ட')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0949.jpg',
    words: 'வரைபடம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Public outdoor stone monument statue of a mother and child; does not show a map ('வரைபடம்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0974.jpg',
    words: 'வாசகர்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Engraving of Spanish conquistadors marching in armor through jungle; does not show a reader ('வாசகர்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0976.jpg',
    words: 'வாசல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Hilltop scenic overview of countryside valley and horizon; does not show an entrance or doorway ('வாசல்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS0985.jpg',
    words: 'வான்கோழி',
    visible_watermark: 'no',
    shows_word: 'partly',
    suitable_for_class_3: 'no',
    reason: "Instructional hunting guide poster titled 'HOW TO CHECK & TAG YOUR TURKEY'; hunting compliance sheet rather than a clear turkey"
  },
  {
    file: 'public/assets/class-3/tamil/images/FTS1021.jpg',
    words: 'விளையாட்டுத்திடல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Urban street in Hong Kong with a traditional Chinese theatrical stage archway; does not show a sports playground/field ('விளையாட்டுத்திடல்')"
  },
  {
    file: 'public/assets/class-3/tamil/images/Q001.jpg',
    words: 'முயல்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Shows an empty rabbit burrow/hole in dirt; no rabbit ('முயல்') is visible"
  },
  {
    file: 'public/assets/class-3/tamil/images/Q013.jpg',
    words: 'எலி',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Bare animal skull bone resting on a wooden table; does not show a living rat/mouse ('எலி') and is scary for Class 3"
  },
  {
    file: 'public/assets/class-3/tamil/images/Q068.jpg',
    words: 'திமிங்கலம்',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Underwater sea floor with coral and kelp; no whale ('திமிங்கலம்') is shown"
  },
  {
    file: 'public/assets/class-3/tamil/images/Q104.jpg',
    words: 'பை',
    visible_watermark: 'no',
    shows_word: 'no',
    suitable_for_class_3: 'no',
    reason: "Crowd of anime fans and cosplayers gathered at a festival stage; does not show a bag ('பை')"
  }
];

function escapeCsvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return `"${val}"`;
}

function run() {
  const header = ['file', 'words', 'visible_watermark', 'shows_word', 'suitable_for_class_3', 'reason'].join(',');
  const lines = [header];

  for (const rec of failedRecords) {
    const row = [
      escapeCsvField(rec.file),
      escapeCsvField(rec.words),
      escapeCsvField(rec.visible_watermark),
      escapeCsvField(rec.shows_word),
      escapeCsvField(rec.suitable_for_class_3),
      escapeCsvField(rec.reason),
    ].join(',');
    lines.push(row);
  }

  const outPath = path.resolve('docs/image-visual-audit.csv');
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${failedRecords.length} failed rows to ${outPath}`);
}

run();
