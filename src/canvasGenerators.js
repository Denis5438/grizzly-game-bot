const { createCanvas, loadImage } = require('canvas');

// Вспомогательная функция скругленного прямоугольника
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Вспомогательная функция рисования сердечка
function drawHeart(ctx, x, y, size, fillStyle = '#e11d48') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(0, topCurveHeight);
  // Левая верхняя дуга
  ctx.bezierCurveTo(
    -size / 2, -topCurveHeight,
    -size, size / 3,
    0, size
  );
  // Правая верхняя дуга
  ctx.bezierCurveTo(
    size, size / 3,
    size / 2, -topCurveHeight,
    0, topCurveHeight
  );
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

// Рисование милого авокадо
function drawAvocado(ctx, x, y, scale = 1, isLeft = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (isLeft ? 1 : -1), scale);

  // Кожура авокадо (темно-зеленая)
  ctx.beginPath();
  ctx.fillStyle = '#2d5a27';
  ctx.ellipse(0, 5, 28, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Мякоть авокадо (светло-зеленая/лаймовая)
  ctx.beginPath();
  ctx.fillStyle = '#a3e635';
  ctx.ellipse(0, 5, 24, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Внутренняя светлая зона
  ctx.beginPath();
  ctx.fillStyle = '#d9f99d';
  ctx.ellipse(0, 7, 19, 27, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isLeft) {
    // Косточка в форме сердечка
    drawHeart(ctx, 0, 10, 14, '#78350f');
  } else {
    // Круглая косточка с сердечком
    ctx.beginPath();
    ctx.fillStyle = '#78350f';
    ctx.arc(0, 17, 11, 0, Math.PI * 2);
    ctx.fill();
    drawHeart(ctx, 0, 13, 6, '#f43f5e');
  }

  // Глазки
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-7, -8, 2.5, 0, Math.PI * 2);
  ctx.arc(7, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Блики в глазах
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6.5, -9, 0.9, 0, Math.PI * 2);
  ctx.arc(7.5, -9, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Румянец
  ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
  ctx.beginPath();
  ctx.arc(-11, -3, 3, 0, Math.PI * 2);
  ctx.arc(11, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  // Улыбочка
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -4, 4, 0.2 * Math.PI, 0.8 * Math.PI, false);
  ctx.stroke();

  ctx.restore();
}

// Разбиение текста на строки с автопереносом и переносом сверхдлинных слов
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const rawWord of words) {
    let word = rawWord;
    while (ctx.measureText(word).width > maxWidth && word.length > 15) {
      let sliceLen = Math.floor(word.length * (maxWidth / ctx.measureText(word).width));
      if (sliceLen < 1) sliceLen = 1;
      const part = word.slice(0, sliceLen);
      word = word.slice(sliceLen);
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(part);
    }

    const testLine = currentLine ? currentLine + ' ' + word : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// -------------------------------------------------------------
// 1. СВИДЕТЕЛЬСТВО О ЗАКЛЮЧЕНИИ ОТНОШЕНИЙ
// -------------------------------------------------------------
async function generateMarriageCertificate({ partner1Nick, partner2Nick, dateStr, partner1Avatar, partner2Avatar }) {
  const width = 1000;
  const height = 660;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Фон (элегантный пергамент / кремовый градиент)
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 600);
  bgGrad.addColorStop(0, '#fffef8');
  bgGrad.addColorStop(0.7, '#fef6e4');
  bgGrad.addColorStop(1, '#faebd7');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Двойная золотая рамка со стильными уголками
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 5;
  ctx.strokeRect(25, 25, width - 50, height - 50);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, width - 68, height - 68);

  // Декоративные уголки
  const corners = [
    [34, 34],
    [width - 34, 34],
    [34, height - 34],
    [width - 34, height - 34]
  ];
  ctx.fillStyle = '#b8860b';
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Заголовок свидетельства
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Маленький бейдж над заголовком
  ctx.font = 'bold 12px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#996515';
  ctx.fillText('• РЕЕСТР ВЕЧНЫХ ЧУВСТВ GRIZZLY & CELYA •', width / 2, 52);

  // Главный заголовок
  ctx.font = 'bold 30px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#4a2800';
  ctx.fillText('СВИДЕТЕЛЬСТВО О ЗАКЛЮЧЕНИИ ОТНОШЕНИЙ', width / 2, 74);

  // Золотая разделительная линия с сердечком
  const lineY = 118;
  const lineGrad = ctx.createLinearGradient(150, lineY, width - 150, lineY);
  lineGrad.addColorStop(0, 'rgba(184, 134, 11, 0)');
  lineGrad.addColorStop(0.3, 'rgba(184, 134, 11, 0.8)');
  lineGrad.addColorStop(0.7, 'rgba(184, 134, 11, 0.8)');
  lineGrad.addColorStop(1, 'rgba(184, 134, 11, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(150, lineY);
  ctx.lineTo(470, lineY);
  ctx.moveTo(530, lineY);
  ctx.lineTo(width - 150, lineY);
  ctx.stroke();

  // Центральный символ любви в линии (кольца)
  ctx.font = '22px "Segoe UI Emoji", Arial';
  ctx.fillText('💍 💖 💍', width / 2, 106);

  // 4. Милые авокадо по бокам
  drawAvocado(ctx, 95, 230, 1.4, true);
  drawAvocado(ctx, width - 95, 230, 1.4, false);

  // 5. Карточки партнеров и пульс любви
  const p1X = 270;
  const p2X = width - 270;
  const partnersY = 220;

  // Функция отрисовки аватарки / бейджа с инициалом
  async function drawAvatarBadge(x, y, avatarUrl, name, fallbackColor) {
    const radius = 48;
    ctx.save();
    let loaded = false;
    if (avatarUrl) {
      try {
        const img = await loadImage(avatarUrl);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        loaded = true;
      } catch (e) {
        loaded = false;
      }
    }
    ctx.restore();

    if (!loaded) {
      // Стильный градиентный круг с инициалом
      const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
      grad.addColorStop(0, fallbackColor[0]);
      grad.addColorStop(1, fallbackColor[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Буква
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Futura", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cleanName = (name || '').trim();
      const initial = (cleanName ? cleanName[0] : '?').toUpperCase();
      ctx.fillText(initial, x, y + 2);
    }

    // Золотая обводка бейджа
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Отрисовка двух бейджей
  await drawAvatarBadge(p1X, partnersY, partner1Avatar, partner1Nick, ['#f43f5e', '#fb7185']);
  await drawAvatarBadge(p2X, partnersY, partner2Avatar, partner2Nick, ['#3b82f6', '#60a5fa']);

  // Имена партнеров
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 22px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#1c1917';

  const cleanP1 = (partner1Nick || 'Партнер 1').slice(0, 18);
  const cleanP2 = (partner2Nick || 'Партнер 2').slice(0, 18);
  ctx.fillText(cleanP1, p1X, partnersY + 58);
  ctx.fillText(cleanP2, p2X, partnersY + 58);

  ctx.font = '14px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#78716c';
  ctx.fillText('Влюблён(а)', p1X, partnersY + 84);
  ctx.fillText('Влюблён(а)', p2X, partnersY + 84);

  // Романтическая кардиограмма между ними
  const pulseStartX = p1X + 65;
  const pulseEndX = p2X - 65;
  const pulseY = partnersY;

  ctx.save();
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pulseStartX, pulseY);
  const midX = (pulseStartX + pulseEndX) / 2;
  ctx.lineTo(pulseStartX + 35, pulseY);
  ctx.lineTo(pulseStartX + 45, pulseY - 20);
  ctx.lineTo(pulseStartX + 55, pulseY + 25);
  ctx.lineTo(pulseStartX + 65, pulseY - 30);
  ctx.lineTo(pulseStartX + 75, pulseY + 15);
  ctx.lineTo(midX - 35, pulseY);
  ctx.lineTo(midX + 35, pulseY);
  ctx.lineTo(pulseEndX - 75, pulseY - 15);
  ctx.lineTo(pulseEndX - 65, pulseY + 30);
  ctx.lineTo(pulseEndX - 55, pulseY - 25);
  ctx.lineTo(pulseEndX - 45, pulseY + 20);
  ctx.lineTo(pulseEndX - 35, pulseY);
  ctx.lineTo(pulseEndX, pulseY);
  ctx.stroke();

  // Большое пылающее сердце в центре кардиограммы
  drawHeart(ctx, midX, pulseY - 15, 32, '#e11d48');
  ctx.restore();

  // 6. Священная клятва (vow text) из celya.ru
  const vowText =
    'Этот документ несет в себе священное свидетельство истинности чувств этой прекрасной пары. ' +
    'Мы пожелаем им пусть ручьи страсти всегда их окружают, а любовь, словно древо, крепко ' +
    'укореняется в их сердцах, даря им счастье долгих и сияющих отношений.';

  ctx.save();
  // Элегантная плашка для текста клятвы
  roundRect(ctx, 110, 360, width - 220, 155, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fill();
  ctx.strokeStyle = '#eedcb3';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'italic 18px "Futura", "Segoe UI", "Georgia", Arial, sans-serif';
  ctx.fillStyle = '#451a03';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const vowLines = wrapText(ctx, `«${vowText}»`, width - 260);
  let vY = 385;
  for (const line of vowLines) {
    ctx.fillText(line, width / 2, vY);
    vY += 27;
  }
  ctx.restore();

  // 7. Нижняя строка: Дата регистрации, Печать союза, Подпись
  const footY = 560;

  // Дата
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 15px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#573a08';
  ctx.fillText('📅 Дата регистрации:', 80, footY);
  ctx.font = '16px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#1c1917';
  ctx.fillText(dateStr || new Date().toLocaleDateString('ru-RU'), 80, footY + 24);

  // Печать союза (стильная круглая печать)
  const sealX = width / 2;
  const sealY = footY + 20;
  ctx.save();
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sealX, sealY, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sealX, sealY, 39, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 9px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ ПЕЧАТЬ ЛЮБВИ ★', sealX, sealY - 20);
  ctx.font = '20px "Segoe UI Emoji", Arial';
  ctx.fillText('💖', sealX, sealY);
  ctx.font = 'bold 9px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillText('GRIZZLY & CELYA', sealX, sealY + 20);
  ctx.restore();

  // Подпись регистратора
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#573a08';
  ctx.fillText('Подпись регистратора:', width - 80, footY);
  ctx.font = 'italic 20px "Georgia", "Times New Roman", serif';
  ctx.fillStyle = '#292524';
  ctx.fillText('Celestiana Cupid', width - 80, footY + 22);

  // Линия подписи
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width - 240, footY + 48);
  ctx.lineTo(width - 80, footY + 48);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// -------------------------------------------------------------
// 2. КАРТОЧКА УЗИ БЕРЕМЕННОСТИ
// -------------------------------------------------------------
async function generateUltrasoundCard({ weeks = 4, heartbeat = 155, genderText = 'Секрет 🙈', motherNick = 'Мама', fatherNick = 'Папа', leftHours = 48 }) {
  const width = 800;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Темный экран медицинского УЗИ монитора
  ctx.fillStyle = '#0a0f16';
  ctx.fillRect(0, 0, width, height);

  // Сетка сканера
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Верхняя панель HUD
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 48);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(width, 48);
  ctx.stroke();

  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('GRIZZLY OB/GYN CLINIC • 4D ULTRASOUND SCANNER', 20, 24);

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`MI: 0.8  TIS: 0.2  FREQ: 3.5MHz  ${nowStr}`, width - 20, 24);

  // 3. Зона сканирования (Сектор УЗИ луча)
  const sectorCenterX = 240;
  const sectorCenterY = 70;
  const sectorRadius = 370;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sectorCenterX, sectorCenterY);
  ctx.arc(sectorCenterX, sectorCenterY, sectorRadius, 0.28 * Math.PI, 0.72 * Math.PI);
  ctx.closePath();
  ctx.clip();

  // Градиентное ультразвуковое поле
  const fieldGrad = ctx.createRadialGradient(sectorCenterX, sectorCenterY, 30, sectorCenterX, sectorCenterY, sectorRadius);
  fieldGrad.addColorStop(0, '#102236');
  fieldGrad.addColorStop(0.5, '#0c1827');
  fieldGrad.addColorStop(1, '#070f1a');
  ctx.fillStyle = fieldGrad;
  ctx.fill();

  // Ультразвуковые волны-концентрические круги
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  for (let r = 80; r < sectorRadius; r += 50) {
    ctx.beginPath();
    ctx.arc(sectorCenterX, sectorCenterY, r, 0.28 * Math.PI, 0.72 * Math.PI);
    ctx.stroke();
  }

  // Силуэт плода / эмбриона с мягким свечением
  const embryoX = sectorCenterX;
  const embryoY = sectorCenterY + 210;

  // Амниотический мешочек
  ctx.beginPath();
  ctx.fillStyle = 'rgba(30, 58, 88, 0.5)';
  ctx.ellipse(embryoX, embryoY, 110, 85, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Силуэт плода
  ctx.fillStyle = 'rgba(240, 249, 255, 0.85)';
  // Головка
  ctx.beginPath();
  ctx.arc(embryoX - 35, embryoY - 20, 32, 0, Math.PI * 2);
  ctx.fill();

  // Тельце плода
  ctx.beginPath();
  ctx.ellipse(embryoX + 15, embryoY + 5, 45, 30, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Свернутые ручки/ножки
  ctx.beginPath();
  ctx.arc(embryoX - 10, embryoY + 22, 16, 0, Math.PI * 2);
  ctx.arc(embryoX + 35, embryoY + 25, 14, 0, Math.PI * 2);
  ctx.fill();

  // Линии курсоров измерения (Caliper)
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(embryoX - 65, embryoY - 20);
  ctx.lineTo(embryoX + 60, embryoY + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // Отметки крестиков
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('+', embryoX - 65, embryoY - 20);
  ctx.fillText('+', embryoX + 60, embryoY + 10);
  ctx.restore();

  // 4. Правая информационная панель с параметрами
  const infoX = 490;
  const panelW = width - infoX - 25;

  roundRect(ctx, infoX, 65, panelW, 375, 12);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let py = 85;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Родители
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('ПАРА / ПАЦИЕНТЫ:', infoX + 20, py);
  ctx.font = 'bold 15px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  const cleanMother = (motherNick || 'Мама').slice(0, 14);
  const cleanFather = (fatherNick || 'Папа').slice(0, 14);
  ctx.fillText(`${cleanMother} ❤️ ${cleanFather}`, infoX + 20, py + 18);
  py += 52;

  // Срок беременности
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('СРОК БЕРЕМЕННОСТИ:', infoX + 20, py);
  ctx.font = 'bold 24px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText(`${weeks} НЕДЕЛЬ`, infoX + 20, py + 18);
  py += 55;

  // Пульс и ЧСС
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('ЧАСТОТА СЕРДЦЕБИЕНИЯ (ЧСС):', infoX + 20, py);
  ctx.font = 'bold 22px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f43f5e';
  ctx.fillText(`💓 ${heartbeat} уд/мин`, infoX + 20, py + 18);
  py += 46;

  // Мини-кардиограмма ЧСС
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const ecgX = infoX + 20;
  const ecgY = py + 8;
  ctx.moveTo(ecgX, ecgY);
  ctx.lineTo(ecgX + 30, ecgY);
  ctx.lineTo(ecgX + 40, ecgY - 14);
  ctx.lineTo(ecgX + 50, ecgY + 16);
  ctx.lineTo(ecgX + 60, ecgY - 20);
  ctx.lineTo(ecgX + 70, ecgY + 8);
  ctx.lineTo(ecgX + 90, ecgY);
  ctx.lineTo(ecgX + 160, ecgY);
  ctx.stroke();
  py += 36;

  // Пол будущего малыша
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('ПОЛ БУДУЩЕГО МАЛЫША:', infoX + 20, py);
  ctx.font = 'bold 20px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(genderText, infoX + 20, py + 18);
  py += 50;

  // Статус
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('ДИАГНОСТИКА:', infoX + 20, py);
  ctx.font = 'bold 14px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('✅ Развитие в норме • Патологий нет', infoX + 20, py + 18);

  // 5. Нижняя панель с заключением
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, height - 55, width, 55);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 55);
  ctx.lineTo(width, height - 55);
  ctx.stroke();

  ctx.font = 'bold 13px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`📋 ЗАКЛЮЧЕНИЕ: Беременность протекает благоприятно. До родов осталось ~${leftHours} ч.`, 25, height - 28);

  return canvas.toBuffer('image/png');
}

// -------------------------------------------------------------
// 3. ГЕНЕРАТОР ЦИТАТ СООБЩЕНИЙ
// -------------------------------------------------------------
async function generateQuoteCard({ text, authorName, authorAvatarUrl, timestamp }) {
  const width = 750;
  // Предварительный расчет высоты по тексту
  const tempCanvas = createCanvas(width, 200);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '20px "Futura", "Segoe UI", Arial, sans-serif';

  const cleanText = (text || 'Без текста').replace(/[\r\t]/g, ' ');
  const maxTextWidth = 470;
  const rawParagraphs = cleanText.split('\n');
  const lines = [];

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const wrapped = wrapText(tempCtx, para, maxTextWidth);
    lines.push(...wrapped);
  }

  const limitedLines = lines.slice(0, 20); // Ограничение строк
  const lineHeight = 28;
  const textBlockHeight = Math.max(70, limitedLines.length * lineHeight);
  const totalHeight = Math.max(260, textBlockHeight + 160);

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext('2d');

  // Фон карточки - стильный темный градиент
  const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
  bgGrad.addColorStop(0, '#111827');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  // Тонкая рамка вокруг всей цитаты
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, totalHeight - 2);

  // Аватарка автора слева
  const avatarX = 85;
  const avatarY = 95;
  const avatarRadius = 45;

  let loadedAvatar = false;
  if (authorAvatarUrl) {
    try {
      const avatarImg = await loadImage(authorAvatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();
      loadedAvatar = true;
    } catch (e) {
      loadedAvatar = false;
    }
  }

  if (!loadedAvatar) {
    // Стильный дефолтный бейдж с градиентом
    const g = ctx.createLinearGradient(avatarX - avatarRadius, avatarY - avatarRadius, avatarX + avatarRadius, avatarY + avatarRadius);
    g.addColorStop(0, '#6366f1');
    g.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Futura", "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cleanAuthor = (authorName || '').trim();
    const initChar = (cleanAuthor ? cleanAuthor[0] : 'А').toUpperCase();
    ctx.fillText(initChar, avatarX, avatarY + 2);
  }

  // Обводка аватарки
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Облачко сообщения (Telegram Bubble)
  const bubbleX = 160;
  const bubbleY = 40;
  const bubbleW = width - bubbleX - 40;
  const bubbleH = totalHeight - 80;

  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 16);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Автор (сверху в бабле)
  ctx.font = 'bold 20px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(authorName || 'Пользователь', bubbleX + 24, bubbleY + 18);

  // Кавычки-водяной знак
  ctx.font = 'bold 65px "Georgia", serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillText('“', bubbleX + bubbleW - 60, bubbleY + 60);

  // Текст цитаты
  ctx.font = '19px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f8fafc';
  let tY = bubbleY + 52;
  for (const line of limitedLines) {
    ctx.fillText(line, bubbleX + 24, tY);
    tY += lineHeight;
  }

  // Время отправки в правом нижнем углу бабла
  ctx.font = '13px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const timeText = timestamp || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(`${timeText}  ✓✓`, bubbleX + bubbleW - 18, bubbleY + bubbleH - 14);

  // Водяной знак бота
  ctx.font = '11px "Futura", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('Grizzly Bot • Цитата', 25, totalHeight - 16);

  return canvas.toBuffer('image/png');
}

// -------------------------------------------------------------
// 4. ГЕНЕРАТОР ДЕМОТИВАТОРОВ
// -------------------------------------------------------------
async function generateDemotivator({ imageBuffer, title = '', subtitle = '' }) {
  const baseImg = await loadImage(imageBuffer);

  // Целевой размер фото внутри демотиватора с безопасным ограничением высоты
  const targetPhotoW = 620;
  const rawRatio = (baseImg.height || 1) / Math.max(1, baseImg.width || 1);
  const targetPhotoH = Math.min(850, Math.max(120, Math.round(targetPhotoW * rawRatio)));

  const canvasW = 750;
  const topPad = 45;
  const bottomPad = 60;
  const textSpace = 130;
  const canvasH = topPad + targetPhotoH + textSpace + bottomPad;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Черный классический фон
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Белая классическая рамка вокруг фото
  const photoX = (canvasW - targetPhotoW) / 2;
  const photoY = topPad;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(photoX - 6, photoY - 6, targetPhotoW + 12, targetPhotoH + 12);

  // Отрисовка фото
  ctx.drawImage(baseImg, photoX, photoY, targetPhotoW, targetPhotoH);

  // Текст: Заголовок
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const titleY = photoY + targetPhotoH + 30;
  ctx.font = 'bold 36px "Times New Roman", "Georgia", serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title || 'ДЕМОТИВАТОР', canvasW / 2, titleY);

  // Текст: Подзаголовок
  if (subtitle) {
    ctx.font = '20px "Times New Roman", "Georgia", Arial, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(subtitle, canvasW / 2, titleY + 48);
  }

  return canvas.toBuffer('image/png');
}

// -------------------------------------------------------------
// 5. ФОТОФИЛЬТРЫ НА CANVAS
// -------------------------------------------------------------
async function applyPhotoFilter(imageBuffer, filterType) {
  const img = await loadImage(imageBuffer);
  // Ограничиваем размер для производительности и безопасности памяти
  const maxDim = 1200;
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const f = (filterType || '').toLowerCase().trim();

  if (f === 'зерк' || f === 'mirror') {
    // Зеркальное отражение по горизонтали
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toBuffer('image/png');
  }

  // Отрисовка базового изображения
  ctx.drawImage(img, 0, 0, w, h);

  if (f === 'пиксель' || f === 'pixel') {
    // Быстрый качественный пиксель-арт фильтр через масштабирование без сглаживания
    const pixelSize = Math.max(12, Math.round(Math.min(w, h) / 35));
    const smallW = Math.max(1, Math.floor(w / pixelSize));
    const smallH = Math.max(1, Math.floor(h / pixelSize));

    const smallCanvas = createCanvas(smallW, smallH);
    const smallCtx = smallCanvas.getContext('2d');
    smallCtx.drawImage(canvas, 0, 0, smallW, smallH);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
    return canvas.toBuffer('image/png');
  }

  if (f === 'блюр' || f === 'blur') {
    // Быстрый качественный эффект размытия (Downscale -> Upscale со сглаживанием в 2 прохода)
    const blurCanvas = createCanvas(Math.floor(w / 12), Math.floor(h / 12));
    const bCtx = blurCanvas.getContext('2d');
    bCtx.imageSmoothingEnabled = true;
    bCtx.drawImage(canvas, 0, 0, blurCanvas.width, blurCanvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(blurCanvas, 0, 0, blurCanvas.width, blurCanvas.height, 0, 0, w, h);
    return canvas.toBuffer('image/png');
  }

  // Попиксельные фильтры (ЧБ, Негатив)
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (f === 'чб' || f === 'сепия' || f === 'gray' || f === 'grey') {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (f === 'негатив' || f === 'invert') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateMarriageCertificate,
  generateUltrasoundCard,
  generateQuoteCard,
  generateDemotivator,
  applyPhotoFilter
};
