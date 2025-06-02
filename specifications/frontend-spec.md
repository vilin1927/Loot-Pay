# Complete Bot Texts and User Flows - LootPay Telegram Bot

## Bot Start Flow

### Welcome Message (All Users)
```
Привет, это 🎮 LootPay!
Бот для быстрого и надёжного пополнения Steam кошелька

Знакомо? Было?
⏳ Всего 5 минут, и баланс в Steam пополнен…
😤 А вместо этого — долгие ожидания, скрытые наценки и тревога, что средства не дойдут. 

✨ С  LootPay такого не будет ✨
⋯⋯⋯⋯⋯⋯⋯⋯
Пополняй Steam за 15 минут
с удобной оплатой, честным курсом и без риска быть обманутым ⏱️

🔹 Минимальная и прозрачная комиссия **10%** — без скрытых наценок 
🔹 Гарантия возврата при сбоях 
🔹 Поддержка 24/7
⋯⋯⋯⋯⋯⋯⋯⋯
💳 Автоматическое зачисление от {min_amount_rub} ₽ / {min_amount_usd} USD — любые РФ-карты или СБП

🔸 Как это работает?
1️⃣ Запусти бота, включи уведомления, введи Steam ID 
2️⃣ Выбери сумму и оплати через СБП 
3️⃣ Получи уведомление о зачислении 🎉 

Пополняй без риска и обмана — вместе с 🎮 LootPay!
```

**Buttons:**
```
[💰 Пополнить Steam] [📊 История пополнений]
[❓ Поддержка] [📄 О нас / Оферта/ FAQ]
```

## Questionnaire Flow (New Users Only)

### Question 1: Steam Spending Habits
```
📋 Давайте познакомимся! Ответьте на 3 быстрых вопроса, чтобы мы могли лучше вас понимать.

❓ На что чаще всего тратишь деньги в Steam?
```

**Buttons:**
```
[🎮 Игры — покупаю новинки и классику]
[✨ Внутриигровые штуки, кейсы, боевые пропуски]
[🧸 Другое — что-то ещё, не из этого]
[🧘 Вообще не трачу — просто сижу, не покупаю]
```

### Question 2: Previous Experience
```
❓ Пробовал(а) другие пополнялки?
```

**Buttons:**
```
[👍 Да, юзаю]
[👌 Да, но забросил(а)]
[❌ Нет]
```

### Question 3: USD Preference
```
❓ Мы делаем пополнение в USD для всех стран (кроме UK) — гуд?
```

**Buttons:**
```
[✅ Да, ок]
[🇬🇧 Я из Британии]
[❌ Нет, не в тему]
```

### Questionnaire Complete (New Users)
```
🎉 Готово! Ты прошёл опрос — красавчик! Спасибо, что поделился своими предпочтениями 🙌 
Это поможет нам сделать LootPay ещё удобнее и полезнее для тебя.
🔻 Теперь введи логин аккаунта Steam, который будем пополнять.
⚠️ *Внимание!* Пожалуйста, убедитесь, что логин введён правильно.
```

**Buttons:**
```
[🧠 Как найти логин?] [ℹ️ Меню]
```

## Steam Username Input Flow

### Steam Login Request (Returning Users)
```
🧩 Введите логин аккаунта Steam:
⚠️ *Внимание!* Пожалуйста, убедитесь, что логин введён правильно. Если вы допустите ошибку — средства могут уйти другому пользователю, и мы *не сможем вернуть деньги*. Проверьте логин дважды перед подтверждением!
```

**Buttons:**
```
[🧠 Как найти логин?] [ℹ️ Меню]
```

### Steam Login Help Page
```
🔎 Где взять логин Steam?

Логин — это уникальный идентификатор, который вы указывали при регистрации. Он нужен для пополнения вашего аккаунта.

Вот как его узнать:

1️⃣ Откройте приложение Steam 
2️⃣ Нажмите на свой ник в правом верхнем углу 
3️⃣ Выберите «Об аккаунте» 
4️⃣ В разделе «Аккаунт пользователя» вы увидите логин

📎 [Открыть страницу аккаунта в Steam](https://store.steampowered.com/account/) 

🧩 [Перейти к авторизации](https://store.steampowered.com/login/?redir=account%2F&redir_ssl=1)
```

**Button:**
```
[Перейти к пополнению 🎮]
```

## Steam Account Validation Flow

### Account Found (Success)
```
✅ Аккаунт найден!
👤 Логин: {steam_username}
🎮 Всё готово к пополнению!

💰 Выберите сумму пополнения ниже:
— Минимум: {min_amount_usd} USD 
— Максимум: {max_amount_usd} USD
Выберите один из вариантов ниже или введите свою сумму 👇
```

**Buttons:**
```
[5 USD] [10 USD]
[15 USD] [20 USD]
[Своя сумма 🪙]
[Ввести другой логин 🔄]
```

### Account Not Found (Error)
```
⚠️ Не удалось найти такой аккаунт в Steam.

Проверь правильность логина (без пробелов и ошибок) и попробуй снова.

Если не получается — [вот инструкция, где найти логин](https://store.steampowered.com/account/)
```

**Button:**
```
[🧠 Как найти логин?]
```

## Amount Selection Flow

### Custom Amount Input
```
💰 Введите сумму пополнения, учитывая лимиты:
— Минимум: {min_amount_usd} USD 
— Максимум: {max_amount_usd} USD
```

### Amount Too Low Error
```
⚠️ Слишком маленькая сумма.
Минимальная сумма пополнения — {min_amount_usd} USD. 
Пожалуйста, введите сумму не меньше этого значения.
```

**Buttons:**
```
[Пополнить на {min_amount_usd} USD] [💵 Изменить сумму]
```

### Amount Too High Error
```
⚠️ Слишком большая сумма.
Максимальная сумма пополнения — {max_amount_usd} USD. 
Пожалуйста, введите сумму в пределах лимита.
```

**Buttons:**
```
[Пополнить на {max_amount_usd} USD] [💵 Изменить сумму]
```

## Payment Confirmation Flow

### Payment Details Confirmation (Success)
```
🔎 Проверь данные перед оплатой:

🧾 Услуга: Пополнение Steam 
👤 Аккаунт: {steam_username}
💵 Сумма: {amount_usd} USD (≈{amount_rub} ₽) — **комиссия 10% уже включена**

❗️Пожалуйста, убедитесь, что логин и сумма указаны верно. 
В случае ошибки средства могут уйти другому пользователю.
Если всё правильно — выберите способ оплаты ниже 👇
```

**Buttons:**
```
[✅ Оплатить СБП [{amount_rub} ₽]]
[🔁 Изменить логин] [💵 Изменить сумму]
```

### Payment Creation Error
```
🚫 Произошла ошибка при создании оплаты.

Пожалуйста, попробуйте ещё раз чуть позже. 
Если проблема повторяется — обратитесь в поддержку.
```

**Buttons:**
```
[🔁 Изменить логин] [💵 Изменить сумму]
[❗️Поддержка]
```

## Payment Processing Flow

### Payment Initiated
```
⏳ Ваша оплата в процессе.  

Как только платёж будет завершён, мы оповестим вас здесь в чате — ничего не нужно обновлять вручную.
⏳ Если хотите, вы можете обратиться в поддержку
```

**Button:**
```
[🛠 Написать в поддержку]
```

## Webhook Status Messages

### Payment Successful (Status: "Paid")
```
✅ Готово! Оплата прошла успешно, и средства уже зачислены на ваш Steam-аккаунт.

💳 Сумма: {amount} ₽ 
📅 Дата оплаты: {formatted_date} (MSK) 
🧩 Транзакция: {order_uuid}

Спасибо, что воспользовались LootPay!
```

**Button:**
```
[🏠 Главное меню]
```

### Payment Pending (Status: "Pending")
```
⏳ Платёж обрабатывается. Это может занять до 15 минут. Пожалуйста, не закрывайте приложение и дождитесь уведомления.

💳 Сумма: {amount} ₽ 
📅 Дата и время: {formatted_date} (MSK) 
🧩 Транзакция: {order_uuid}

Если возникнут вопросы — напишите в поддержку.
```

**Button:**
```
[🛠 Написать в поддержку]
```

### Payment Failed (Status: "Failed")
```
🚫 Платёж не прошёл. Средства не были списаны или автоматически вернутся на ваш счёт.

💳 Сумма: {amount} ₽ 
📅 Дата попытки оплаты: {formatted_date} (MSK) 
🧩 Транзакция: {order_uuid}

Если деньги списались, но не дошли — свяжитесь с поддержкой, мы поможем!
```

**Button:**
```
[❗️Поддержка]
```

## Transaction History Flow

### No Transactions Yet
```
У вас пока нет ни одного пополнения 😔
Но это легко исправить! Пополните Steam-кошелёк за пару минут — быстро, безопасно и с честным курсом 💳
👇 Выберите действие ниже:
```

**Buttons:**
```
[💰 Пополнить сейчас] [🔄 В начало]
```

### Transaction History Display (3 per page)
```
📅 Дата оплаты: {formatted_date}
🕒 Время (MSK): {formatted_time}
💰 Сумма: {amount_rub} ₽
🔗 Order UUID: {order_uuid}
📤 Статус: {status_text}

---

📅 Дата оплаты: {formatted_date}
🕒 Время (MSK): {formatted_time}
💰 Сумма: {amount_rub} ₽
🔗 Order UUID: {order_uuid}
📤 Статус: {status_text}

---

📅 Дата оплаты: {formatted_date}
🕒 Время (MSK): {formatted_time}
💰 Сумма: {amount_rub} ₽
🔗 Order UUID: {order_uuid}
📤 Статус: {status_text}
```

### Transaction History Buttons (≤3 transactions)
```
[💰 Сделать новое пополнение]
[🛡️ Поддержка]
```

### Transaction History Buttons (>3 transactions with pagination)
```
[💰 Сделать новое пополнение]
[🛡️ Поддержка]
[⬅️ Предыдущая страница] [Следующая страница ➡️]
```

## Main Menu Navigation

### From History to Funding
When user clicks [💰 Сделать новое пополнение] or [💰 Пополнить сейчас]:
- **New users**: Go to questionnaire
- **Existing users**: Go directly to Steam username input

### From Main Menu [💰 Пополнить Steam]
- **New users**: Go to questionnaire 
- **Existing users**: Go directly to Steam username input

## Dynamic Text Variables

### System Settings Variables
- `{min_amount_usd}` - From system_settings table
- `{max_amount_usd}` - From system_settings table
- `{min_amount_rub}` - Calculated from min_amount_usd * exchange_rate

### User Data Variables
- `{steam_username}` - From API response or database
- `{amount_usd}` - User selected amount
- `{amount_rub}` - Calculated total with commission

### Transaction Variables
- `{order_uuid}` - From webhook data
- `{amount}` - From webhook amount field
- `{formatted_date}` - Formatted paid_date_msk
- `{formatted_time}` - Extracted time from paid_date_msk

### Status Text Mapping
```javascript
const statusTexts = {
  'paid': 'Успешно',
  'pending': 'В обработке',
  'processing': 'В обработке', 
  'failed': 'Ошибка'
};
```

## Error Handling Messages

### API Timeout
```
🕐 Превышено время ожидания ответа от сервера.
Пожалуйста, попробуйте ещё раз через несколько минут.
```

### Invalid Input
```
❌ Некорректные данные.
Пожалуйста, проверьте введённую информацию и попробуйте снова.
```

### System Error
```
⚠️ Временная ошибка системы.
Мы уже работаем над решением. Попробуйте позже или обратитесь в поддержку.
```

## Commands Support

### /start Command
Always returns to main menu with welcome message

### /help Command
```
❓ Помощь по LootPay

🎮 Основные команды:
/start - Вернуться в главное меню
/help - Показать эту справку

💰 Как пополнить Steam:
1. Нажмите "Пополнить Steam"
2. Введите логин Steam аккаунта
3. Выберите сумму пополнения
4. Оплатите через СБП

❓ Нужна помощь? Напишите в поддержку!
```

**Button:**
```
[🛠 Написать в поддержку]
```

---

**Document Version**: 2.0  
**Language**: Russian (Primary)  
**Last Updated**: May 30, 2025  
**Status**: Complete and Ready for Implementation

**Note**: All dynamic variables like {steam_username}, {amount_rub}, etc. should be replaced with actual values from database or API responses during runtime.
