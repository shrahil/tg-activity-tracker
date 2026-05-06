import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { frontendHtml } from './frontend'

type Bindings = {
  DB: D1Database
  TG_BOT_TOKEN: string
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/admin/*', async (c, next) => {
  const username = c.env.ADMIN_USERNAME || 'admin'
  const password = c.env.ADMIN_PASSWORD || 'admin'
  const auth = basicAuth({ username, password })
  return auth(c, next)
})

app.use('/api/*', async (c, next) => {
  const username = c.env.ADMIN_USERNAME || 'admin'
  const password = c.env.ADMIN_PASSWORD || 'admin'
  const auth = basicAuth({ username, password })
  return auth(c, next)
})

app.get('/admin', (c) => {
  return c.html(frontendHtml)
})

app.get('/api/chats', async (c) => {
  const query = `
    SELECT id, title, type, CASE WHEN type = 'private' THEN 1 ELSE 0 END as sort_order 
    FROM chats WHERE type != 'private'
    UNION ALL
    SELECT 'private' as id, 'All Private Chats' as title, 'private' as type, 1 as sort_order
    WHERE EXISTS (SELECT 1 FROM chats WHERE type = 'private')
    ORDER BY sort_order, title;
  `
  const { results } = await c.env.DB.prepare(query).all()
  return c.json(results || [])
})

app.get('/api/report', async (c) => {
  const chatId = c.req.query('chat_id')
  if (!chatId) return c.json({ error: 'chat_id is required' }, 400)

  let chatCondition = 'da.chat_id = ?';
  let chatFilterCondition = 'chat_id = ?';
  let bindParams = [chatId, chatId];

  if (chatId === 'private') {
    chatCondition = "da.chat_id IN (SELECT id FROM chats WHERE type = 'private')";
    chatFilterCondition = "chat_id IN (SELECT id FROM chats WHERE type = 'private')";
    bindParams = [];
  }

  const query = `
    WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-6 days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    ),
    chat_users AS (
      SELECT DISTINCT user_id 
      FROM daily_activity 
      WHERE ${chatFilterCondition}
    )
    SELECT 
      u.id as user_id, 
      u.username, 
      u.first_name, 
      u.last_name,
      SUM(IFNULL(da.message_count, 0)) as total_messages,
      COUNT(DISTINCT da.date) as days_active,
      7 - COUNT(DISTINCT da.date) as days_inactive
    FROM chat_users cu
    JOIN users u ON cu.user_id = u.id
    CROSS JOIN dates d
    LEFT JOIN daily_activity da ON cu.user_id = da.user_id AND ${chatCondition} AND da.date = d.date
    GROUP BY u.id
    ORDER BY days_inactive DESC;
  `
  
  let stmt = c.env.DB.prepare(query);
  if (bindParams.length > 0) {
    stmt = stmt.bind(...bindParams);
  }
  const { results } = await stmt.all();
  return c.json(results || [])
})

app.post('/webhook', async (c) => {
  try {
    const update = await c.req.json()
    
    if (update.message && update.message.from && update.message.chat) {
      const user = update.message.from
      const chat = update.message.chat
      const date = new Date(update.message.date * 1000).toISOString().split('T')[0]
      
      // 1. Ensure chat exists
      await c.env.DB.prepare(`
        INSERT INTO chats (id, title, type)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          title=excluded.title,
          type=excluded.type
      `).bind(chat.id, chat.title || chat.first_name || 'Private Chat', chat.type).run()

      // 2. Ensure user exists
      await c.env.DB.prepare(`
        INSERT INTO users (id, username, first_name, last_name)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          username=excluded.username,
          first_name=excluded.first_name,
          last_name=excluded.last_name
      `).bind(user.id, user.username || null, user.first_name || null, user.last_name || null).run()

      // 3. Update daily activity
      await c.env.DB.prepare(`
        INSERT INTO daily_activity (chat_id, user_id, date, message_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(chat_id, user_id, date) DO UPDATE SET 
          message_count = message_count + 1
      `).bind(chat.id, user.id, date).run()
    }
    
    return c.text('OK')
  } catch (err) {
    console.error('Webhook error', err)
    return c.text('Error', 500)
  }
})

export default app
