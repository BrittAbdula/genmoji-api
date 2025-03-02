-- Emoji model statistics table
CREATE TABLE IF NOT EXISTS emoji_model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

-- Emoji category statistics table
CREATE TABLE IF NOT EXISTS emoji_category_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);


CREATE TABLE IF NOT EXISTS emoji_color_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name)
);

-- translated name mapping table
CREATE TABLE IF NOT EXISTS name_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_name TEXT NOT NULL,
  translated_name TEXT NOT NULL,
  type TEXT NOT NULL,
  locale TEXT NOT NULL,
  UNIQUE(original_name, type, locale)
);

insert into name_translations (original_name, translated_name, type, locale) 
values ('red', '红色', 'color', 'zh'),
('orange', '橙色', 'color', 'zh'),
('yellow', '黄色', 'color', 'zh'),
('green', '绿色', 'color', 'zh'),
('blue', '蓝色', 'color', 'zh'),
('purple', '紫色', 'color', 'zh'),
('black', '黑色', 'color', 'zh'),
('gray', '灰色', 'color', 'zh'),
('pink', '粉色', 'color', 'zh'),
('brown', '棕色', 'color', 'zh'),
('cyan', '青色', 'color', 'zh'),
('metallic', '金属色', 'color', 'zh');

insert into name_translations (original_name, translated_name, type, locale) 
values ('red', '赤', 'color', 'ja'),
('orange', '橙', 'color', 'ja'),
('yellow', '黄色', 'color', 'ja'),
('green', '緑', 'color', 'ja'),
('blue', '青', 'color', 'ja'),
('purple', '紫', 'color', 'ja'),
('black', '黒', 'color', 'ja'),
('gray', '灰色', 'color', 'ja'),
('pink', 'ピンク', 'color', 'ja'),
('brown', '茶色', 'color', 'ja'),
('cyan', 'シアン', 'color', 'ja'),
('metallic', '金属色', 'color', 'ja');


insert into name_translations (original_name, translated_name, type, locale) 
values ('red', 'rouge', 'color', 'fr'),
('orange', 'orange', 'color', 'fr'),
('yellow', 'jaune', 'color', 'fr'),
('green', 'vert', 'color', 'fr'),
('blue', 'bleu', 'color', 'fr'),
('purple', 'violet', 'color', 'fr'),
('black', 'noir', 'color', 'fr'),
('gray', 'gris', 'color', 'fr'),
('pink', 'rose', 'color', 'fr'),
('brown', 'marron', 'color', 'fr'),
('cyan', 'cyan', 'color', 'fr'),
('metallic', 'métallique', 'color', 'fr');


insert into name_translations (original_name, translated_name, type, locale) 
values('genmoji', '絵文字', 'model', 'ja'),
('sticker', 'ステッカー', 'model', 'ja'),
('mascot', 'マスコット', 'model', 'ja');


insert into name_translations (original_name, translated_name, type, locale) 
values('genmoji', '絵文字', 'model', 'zh'),
('sticker', '贴纸', 'model', 'zh'),
('mascot', '吉祥物', 'model', 'zh');

insert into name_translations (original_name, translated_name, type, locale) 
values('genmoji', 'émoji', 'model', 'fr'),
('sticker', 'vignette', 'model', 'fr'),
('mascot', 'mascotte', 'model', 'fr');


insert into name_translations (original_name, translated_name, type, locale) 
values('smileys_emotion', '表情符号', 'category', 'zh'),
('people_body', '人物', 'category', 'zh'),
('animals_nature', '动物', 'category', 'zh'),
('food_drink', '食物', 'category', 'zh'),
('travel_places', '旅行', 'category', 'zh'),
('activities', '活动', 'category', 'zh'),
('objects', '物体', 'category', 'zh'),
('symbols', '符号', 'category', 'zh'),
('flags', '国旗', 'category', 'zh'),
('other', '其他', 'category', 'zh');


insert into name_translations (original_name, translated_name, type, locale) 
values('smileys_emotion', 'スマイリーの感情', 'category', 'ja'),
('people_body', '人物', 'category', 'ja'),
('animals_nature', '動物', 'category', 'ja'),
('food_drink', '食べ物', 'category', 'ja'),   
('travel_places', '旅行', 'category', 'ja'),
('activities', '活動', 'category', 'ja'),
('objects', '物体', 'category', 'ja'),
('symbols', '記号', 'category', 'ja'),
('flags', '国旗', 'category', 'ja'),
('other', 'その他', 'category', 'ja');


insert into name_translations (original_name, translated_name, type, locale) 
values('smileys_emotion', 'smileys émotion', 'category', 'fr'),
('people_body', 'personnes', 'category', 'fr'),
('animals_nature', 'animaux', 'category', 'fr'),
('food_drink', 'nourriture', 'category', 'fr'),
('travel_places', 'voyage', 'category', 'fr'),
('activities', 'activités', 'category', 'fr'),
('objects', 'objets', 'category', 'fr'),
('symbols', 'symboles', 'category', 'fr'),
('flags', 'drapeaux', 'category', 'fr'),
('other', 'autres', 'category', 'fr');

