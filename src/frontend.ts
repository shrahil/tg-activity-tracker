export const frontendHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Group Activity</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #3b82f6;
            --danger: #ef4444;
            --warning: #f59e0b;
            --success: #10b981;
        }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 2rem;
            display: flex;
            justify-content: center;
        }
        .container {
            max-width: 1000px;
            width: 100%;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(to right, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p.subtitle {
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }
        .card {
            background-color: var(--card-bg);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #334155;
        }
        th {
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
        }
        tr:last-child td {
            border-bottom: none;
        }
        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .badge.danger { background-color: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .badge.warning { background-color: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .badge.success { background-color: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
        .user-info {
            display: flex;
            flex-direction: column;
        }
        .user-name { font-weight: 500; }
        .user-id { font-size: 0.75rem; color: var(--text-secondary); }
    </style>
</head>
<body>
    <div class="container">
        <h1>Activity Report</h1>
        <p class="subtitle">Showing inactivity over the last 7 days.</p>
        
        <div class="card">
            <table id="report-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Total Posts (7d)</th>
                        <th>Days Active (out of 7)</th>
                        <th>Days Inactive</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="report-body">
                    <tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                const res = await fetch('/api/report');
                const data = await res.json();
                
                const tbody = document.getElementById('report-body');
                tbody.innerHTML = '';
                
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No data available.</td></tr>';
                    return;
                }

                data.sort((a, b) => b.days_inactive - a.days_inactive);

                for (const user of data) {
                    const tr = document.createElement('tr');
                    
                    let statusClass = 'success';
                    let statusText = 'Active';
                    if (user.days_inactive >= 6) {
                        statusClass = 'danger';
                        statusText = 'Highly Inactive';
                    } else if (user.days_inactive >= 4) {
                        statusClass = 'warning';
                        statusText = 'Inactive';
                    }

                    tr.innerHTML = \`
                        <td>
                            <div class="user-info">
                                <span class="user-name">\${user.first_name || ''} \${user.last_name || ''} \${user.username ? '(@' + user.username + ')' : ''}</span>
                                <span class="user-id">ID: \${user.user_id}</span>
                            </div>
                        </td>
                        <td>\${user.total_messages}</td>
                        <td>\${user.days_active} / 7</td>
                        <td>\${user.days_inactive}</td>
                        <td><span class="badge \${statusClass}">\${statusText}</span></td>
                    \`;
                    tbody.appendChild(tr);
                }
            } catch (err) {
                document.getElementById('report-body').innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading data.</td></tr>';
            }
        }

        loadData();
    </script>
</body>
</html>`;
