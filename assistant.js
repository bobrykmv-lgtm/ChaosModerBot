const mineflayer = require('mineflayer');
const { GoogleGenAI } = require('@google/genai');

// 1. Отримуємо налаштування із змінних оточення (Environment Variables)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADMIN_USERNAME = 'W1nUser'; // Твій нік на сервері

if (!GEMINI_API_KEY) {
  console.error('❌ Помилка: Не знайдено GEMINI_API_KEY у змінних оточення!');
  process.exit(1);
}

// 2. Підключення бота до вашого сервера Purpur 1.21.1
const bot = mineflayer.createBot({
  host: process.env.SERVER_HOST || 'Chaosgoodsmp.enderman.cloud',
  port: parseInt(process.env.SERVER_PORT) || 50050,
  username: 'AI_Assistant',
  version: '1.21.1'
});

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 3. Інструкція та характер для ШІ-Помічника
const SYSTEM_PROMPT = `
Ты — интеллектуальный помощник администратора ${ADMIN_USERNAME} на сервере Minecraft ChaosSMP.
Твоя задача — слушать приказы администратора в чате и управлять сервером (баны, муты, варны).

Правила логики:
1. Если администратор отдает четкий приказ (например: "Забань игрока Alex за читы на 7 дней"), ты вызываешь функцию бана.
2. Если в приказе не хватает деталей (например, не указана причина или срок), НЕ выполняй действие сразу, а вызови функцию запроса уточнения (askForClarification), ответив вопросом на русском языке.
3. Отвечай кратко, вежливо и по делу.
`;

bot.once('spawn', () => {
  console.log('🤖 ШІ-Помічник адміністратора успішно підключився до сервера і готовий до роботи.');
});

// 4. Обробка ігрового чату
bot.on('chat', async (username, message) => {
  // Бот реагує ВИКЛЮЧНО на накази від W1nUser
  if (username !== ADMIN_USERNAME) return;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `Администратор приказал: "${message}"` }] }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{
          functionDeclarations: [
            {
              name: 'executeBan',
              description: 'Заблокировать игрока на сервере.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  target: { type: 'STRING', description: 'Ник игрока' },
                  reason: { type: 'STRING', description: 'Причина бана' },
                  time: { type: 'STRING', description: 'Срок бана' }
                },
                required: ['target', 'reason']
              }
            },
            {
              name: 'executeMute',
              description: 'Замутить игрока в чате.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  target: { type: 'STRING', description: 'Ник игрока' },
                  reason: { type: 'STRING', description: 'Причина мута' }
                },
                required: ['target', 'reason']
              }
            },
            {
              name: 'askForClarification',
              description: 'Запросить у администратора недостающие данные (срок, причину).',
              parameters: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING', description: 'Текст вопроса к админу на русском языке' }
                },
                required: ['question']
              }
            }
          ]
        }]
      }
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'executeBan') {
        const { target, reason, time } = call.args;
        bot.chat(`📜 Выполняю приказ: бан игрока ${target}. Причина: ${reason} (${time || 'навсегда'}).`);
        bot.chat(`/ban ${target} ${reason}`);
      } 
      else if (call.name === 'executeMute') {
        const { target, reason } = call.args;
        bot.chat(`🔇 Выполняю приказ: мут игрока ${target} за "${reason}".`);
        bot.chat(`/mute ${target} 1h ${reason}`);
      } 
      else if (call.name === 'askForClarification') {
        bot.chat(`❓ ${call.args.question}`);
      }
    } else if (response.text) {
      bot.chat(response.text);
    }

  } catch (err) {
    console.error('Помилка обробки команди ШІ:', err);
  }
});
