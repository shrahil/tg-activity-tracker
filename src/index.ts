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

// Basic Auth Middleware for Admin Routes
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

app.get('/api/report', async (c) => {
  // Report on the last 7 days
  const query = `
    WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-6 days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    )
    SELECT 
      u.id as user_id, 
      u.username, 
      u.first_name, 
      u.last_name,
      SUM(IFNULL(da.message_count, 0)) as total_messages,
      COUNT(da.date) as days_active,
      7 - COUNT(da.date) as days_inactive
    FROM users u
    CROSS JOIN dates d
    LEFT JOIN daily_activity da ON u.id = da.user_id AND da.date = d.date
    GROUP BY u.id
    ORDER BY days_inactive DESC;
  `
  
  const { results } = await c.env.DB.prepare(query).all()
  return c.json(results || [])
})

app.post('/webhook', async (c) => {
  try {
    const update = await c.req.json()
    
    // Only track messages
    if (update.message && update.message.from) {
      const user = update.message.from
      const date = new Date(update.message.date * 1000).toISOString().split('T')[0]
      
      // 1. Ensure user exists
      await c.env.DB.prepare(`
        INSERT INTO users (id, username, first_name, last_name)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          username=excluded.username,
          first_name=excluded.first_name,
          last_name=excluded.last_name
      `).bind(user.id, user.username || null, user.first_name || null, user.last_name || null).run()

      // 2. Update daily activity
      await c.env.DB.prepare(`
        INSERT INTO daily_activity (user_id, date, message_count)
        VALUES (?, ?, 1)
        ON CONFLICT(user_id, date) DO UPDATE SET 
          message_count = message_count + 1
      `).bind(user.id, date).run()
    }
    
    return c.text('OK')
  } catch (err) {
    console.error('Webhook error', err)
    return c.text('Error', 500)
  }
})

export default app
