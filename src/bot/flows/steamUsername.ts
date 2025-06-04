import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../utils/logger';
import { setState } from '../../services/state/stateService';
import { payDigitalService } from '../../services/paydigital/paydigitalService';

const STEAM_USERNAME_PROMPT = `🧩 Введите логин аккаунта Steam:
⚠️ *Внимание!* Пожалуйста, убедитесь, что логин введён правильно. Если вы допустите ошибку — средства могут уйти другому пользователю, и мы *не сможем вернуть деньги*. Проверьте логин дважды перед подтверждением!`;

const STEAM_USERNAME_HELP = `🔎 Где взять логин Steam?

Логин — это уникальный идентификатор, который вы указывали при регистрации. Он нужен для пополнения вашего аккаунта.

Вот как его узнать:

1️⃣ Откройте приложение Steam 
2️⃣ Нажмите на свой ник в правом верхнем углу 
3️⃣ Выберите «Об аккаунте» 
4️⃣ В разделе «Аккаунт пользователя» вы увидите логин

📎 [Открыть страницу аккаунта в Steam](https://store.steampowered.com/account/) 

🧩 [Перейти к авторизации](https://store.steampowered.com/login/?redir=account%2F&redir_ssl=1)`;

const STEAM_USERNAME_ERROR = `⚠️ Не удалось найти такой аккаунт в Steam.

Проверь правильность логина (без пробелов и ошибок) и попробуй снова.

Если не получается — [вот инструкция, где найти логин](https://store.steampowered.com/account/)`;

const STEAM_USERNAME_SUCCESS = (username: string) => `✅ Аккаунт найден!
👤 Логин: ${username}
🎮 Всё готово к пополнению!

💰 Выберите сумму пополнения ниже:
— Минимум: 5 USD 
— Максимум: 100 USD
Выберите один из вариантов ниже или введите свою сумму 👇`;

// Export validateSteamUsername function
export async function validateSteamUsername(username: string): Promise<boolean> {
  return await payDigitalService.validateSteamUsername(username);
}

export async function handleSteamUsernameRequest(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  username?: string
): Promise<void> {
  try {
    if (!username) {
      // Initial prompt
      await bot.sendMessage(chatId, STEAM_USERNAME_PROMPT, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🧠 Как найти логин?', callback_data: 'steam_login_help' },
              { text: 'ℹ️ Меню', callback_data: 'main_menu' }
            ]
          ]
        }
      });
      await setState(userId, 'STEAM_USERNAME', {});
      return;
    }

    // Validate username
    const isValid = await validateSteamUsername(username);
    if (!isValid) {
      await bot.sendMessage(chatId, STEAM_USERNAME_ERROR, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🧠 Как найти логин?', callback_data: 'steam_login_help' }]
          ]
        }
      });
      return;
    }

    // Store username and move to amount selection
    await setState(userId, 'AMOUNT_SELECTION', { steamUsername: username });
    
    // Send success message with amount selection buttons
    await bot.sendMessage(chatId, STEAM_USERNAME_SUCCESS(username), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '5 USD', callback_data: 'amount_5' },
            { text: '10 USD', callback_data: 'amount_10' }
          ],
          [
            { text: '15 USD', callback_data: 'amount_15' },
            { text: '20 USD', callback_data: 'amount_20' }
          ],
          [
            { text: 'Своя сумма 🪙', callback_data: 'amount_custom' }
          ],
          [
            { text: 'Ввести другой логин 🔄', callback_data: 'steam_username' }
          ]
        ]
      }
    });

    logger.info('Steam username validated', {
      userId,
      username
    });

  } catch (error) {
    logger.error('Error handling Steam username', {
      error,
      userId,
      username
    });
    throw error;
  }
}

export async function handleSteamUsernameHelp(
  bot: TelegramBot,
  chatId: number,
  userId: number
): Promise<void> {
  try {
    await bot.sendMessage(chatId, STEAM_USERNAME_HELP, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Перейти к пополнению 🎮', callback_data: 'steam_username' }]
        ]
      }
    });
  } catch (error) {
    logger.error('Error sending Steam username help', {
      error,
      userId
    });
    throw error;
  }
} 