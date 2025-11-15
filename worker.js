// 使用 Cloudflare Workers 的 KV 命名空间来存储密码和导航数据
// 在 Worker 设置中，绑定一个 KV 命名空间，变量名设为 NAVIGATION_STORE

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * 主请求处理函数
 * @param {Request} request
 */
async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // 处理数据获取请求
  if (path === '/data' && request.method === 'GET') {
    return handleGetData(request)
  }

  // 处理管理面板路由
  if (path.startsWith('/admin')) {
    return handleAdminRequest(request)
  }

  // 处理根路径，显示导航主页
  if (path === '/') {
    return new Response(generateHomePage(), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    })
  }

  // 默认返回主页
  return new Response(generateHomePage(), {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  })
}

/**
 * 处理获取导航数据请求
 * @param {Request} request
 */
async function handleGetData(request) {
  try {
    // 从 KV 获取存储的分类和网站数据
    const categories = await NAVIGATION_STORE.get('categories')
    const sites = await NAVIGATION_STORE.get('sites')
    
    return new Response(JSON.stringify({
      categories: categories ? JSON.parse(categories) : [],
      sites: sites ? JSON.parse(sites) : []
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      categories: [],
      sites: []
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 处理管理面板相关请求
 * @param {Request} request
 */
async function handleAdminRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // 处理管理员登录验证
  if (path === '/admin/auth' && request.method === 'POST') {
    return handleAuth(request)
  }

  // 处理数据保存
  if (path === '/admin/save' && request.method === 'POST') {
    return handleSaveData(request)
  }

  // 处理密码修改
  if (path === '/admin/change-password' && request.method === 'POST') {
    return handleChangePassword(request)
  }

  // 处理退出登录
  if (path === '/admin/logout' && request.method === 'POST') {
    return handleLogout(request)
  }

  // 检查会话
  const session = await checkSession(request)
  
  // 如果已登录，直接显示管理面板，否则显示登录页面
  if (session.isAuthenticated) {
    return new Response(generateAdminPage(true), {
      headers: { 
        'Content-Type': 'text/html; charset=UTF-8',
        'Set-Cookie': `admin_session=${session.token}; Max-Age=3600; Path=/; HttpOnly`
      },
    })
  } else {
    return new Response(generateAdminPage(false), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    })
  }
}

/**
 * 检查会话状态
 * @param {Request} request
 */
async function checkSession(request) {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return { isAuthenticated: false }
  
  const cookies = cookieHeader.split(';').map(c => c.trim())
  const sessionCookie = cookies.find(c => c.startsWith('admin_session='))
  
  if (!sessionCookie) return { isAuthenticated: false }
  
  const token = sessionCookie.split('=')[1]
  if (!token) return { isAuthenticated: false }
  
  // 验证令牌（这里使用简单的固定令牌，生产环境应使用更安全的方法）
  const storedToken = await NAVIGATION_STORE.get('admin_session')
  if (storedToken === token) {
    return { isAuthenticated: true, token }
  }
  
  return { isAuthenticated: false }
}

/**
 * 处理管理员登录验证
 * @param {Request} request
 */
async function handleAuth(request) {
  try {
    const formData = await request.formData()
    const inputPassword = formData.get('password')

    // 从 KV 获取存储的密码
    const storedPassword = await NAVIGATION_STORE.get('admin_password')

    // 如果尚未设置密码，则设置新密码
    if (!storedPassword) {
      await NAVIGATION_STORE.put('admin_password', inputPassword)
      // 生成会话令牌
      const token = generateToken()
      await NAVIGATION_STORE.put('admin_session', token)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 
          'Set-Cookie': `admin_session=${token}; Max-Age=3600; Path=/; HttpOnly`
        },
      })
    }

    // 验证密码
    if (inputPassword === storedPassword) {
      // 生成会话令牌
      const token = generateToken()
      await NAVIGATION_STORE.put('admin_session', token)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 
          'Set-Cookie': `admin_session=${token}; Max-Age=3600; Path=/; HttpOnly`
        },
      })
    } else {
      return new Response(JSON.stringify({ success: false, message: '密码错误' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: '服务器错误' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 处理退出登录
 * @param {Request} request
 */
async function handleLogout(request) {
  await NAVIGATION_STORE.delete('admin_session')
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_session=; Max-Age=0; Path=/; HttpOnly'
    },
  })
}

/**
 * 生成随机令牌
 */
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * 处理密码修改
 * @param {Request} request
 */
async function handleChangePassword(request) {
  try {
    const { currentPassword, newPassword, confirmPassword } = await request.json()
    
    // 验证当前密码
    const storedPassword = await NAVIGATION_STORE.get('admin_password')
    if (currentPassword !== storedPassword) {
      return new Response(JSON.stringify({ success: false, message: '当前密码错误' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({ success: false, message: '新密码和确认密码不一致' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // 更新密码
    await NAVIGATION_STORE.put('admin_password', newPassword)
    
    return new Response(JSON.stringify({ success: true, message: '密码修改成功' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: '修改失败' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 处理导航数据保存
 * @param {Request} request
 */
async function handleSaveData(request) {
  try {
    const { categories, sites } = await request.json()

    // 将分类和网站数据存储到 KV
    await NAVIGATION_STORE.put('categories', JSON.stringify(categories))
    await NAVIGATION_STORE.put('sites', JSON.stringify(sites))

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: '保存失败' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 生成导航主页 HTML
 */
function generateHomePage() {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>我的导航页</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        
        :root {
          --primary: #6366f1;
          --primary-dark: #4f46e5;
          --secondary: #8b5cf6;
          --accent: #06b6d4;
          --light: #f8fafc;
          --dark: #1e293b;
          --gray: #64748b;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --card-bg: rgba(255, 255, 255, 0.92);
          --shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          --gradient-secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        body { 
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
          background: var(--gradient);
          min-height: 100vh;
          padding: 20px;
          color: var(--dark);
          line-height: 1.6;
          display: flex;
          flex-direction: column;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          flex: 1;
          width: 100%;
        }
        
        .header { 
          text-align: center; 
          color: white;
          margin-bottom: 40px;
          padding: 20px 0;
        }
        
        .header h1 { 
          font-size: 2.8rem; 
          margin-bottom: 12px;
          font-weight: 800;
          text-shadow: 0 4px 6px rgba(0,0,0,0.1);
          background: linear-gradient(to right, #fff, #e0e7ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }
        
        .header p { 
          font-size: 1.2rem; 
          opacity: 0.9;
          max-width: 600px;
          margin: 0 auto;
          font-weight: 300;
        }
        
        .admin-footer {
          text-align: center;
          margin-top: 50px;
          padding: 20px 0;
        }
        
        .admin-link {
          color: white;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.2);
          padding: 12px 24px;
          border-radius: 25px;
          font-size: 0.95rem;
          transition: var(--transition);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }
        
        .admin-link:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .category { 
          background: var(--card-bg);
          backdrop-filter: blur(10px);
          border-radius: 18px;
          padding: 25px;
          margin-bottom: 30px;
          box-shadow: var(--shadow);
          border: 1px solid rgba(255, 255, 255, 0.3);
          transition: var(--transition);
        }
        
        .category:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.25);
        }
        
        .category-title { 
          color: var(--primary-dark); 
          font-size: 1.5rem; 
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          font-weight: 700;
        }
        
        .category-title i {
          margin-right: 10px;
          font-size: 1.3rem;
          background: var(--gradient-secondary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .sites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }
        
        .site-card {
          background: white;
          border-radius: 14px;
          padding: 22px 12px;
          text-align: center;
          transition: var(--transition);
          text-decoration: none;
          color: var(--dark);
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(226, 232, 240, 0.8);
          position: relative;
          overflow: hidden;
        }
        
        .site-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--gradient);
        }
        
        .site-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.25);
          color: var(--primary);
        }
        
        .site-icon {
          font-size: 2.2rem;
          margin-bottom: 12px;
          height: 65px;
          width: 65px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient);
          border-radius: 50%;
          color: white;
          transition: var(--transition);
        }
        
        .site-card:hover .site-icon {
          transform: scale(1.08);
          background: var(--gradient-secondary);
        }
        
        .site-name {
          font-weight: 600;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        
        .loading {
          text-align: center;
          color: white;
          font-size: 1.1rem;
          padding: 40px;
        }
        
        .loading-spinner {
          display: inline-block;
          width: 36px;
          height: 36px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-bottom: 12px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: white;
        }
        
        .empty-state i {
          font-size: 3.5rem;
          margin-bottom: 18px;
          opacity: 0.7;
        }
        
        .empty-state h3 {
          font-size: 1.4rem;
          margin-bottom: 12px;
        }
        
        .empty-state a {
          color: #fbbf24;
          text-decoration: none;
          font-weight: 600;
          transition: var(--transition);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.1);
          padding: 10px 20px;
          border-radius: 25px;
        }
        
        .empty-state a:hover {
          color: #f59e0b;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        
        /* 移动端优化 */
        @media (max-width: 768px) {
          body {
            padding: 15px;
          }
          
          .header {
            margin-bottom: 30px;
            padding: 15px 0;
          }
          
          .header h1 { 
            font-size: 2.2rem; 
            margin-bottom: 10px;
          }
          
          .header p {
            font-size: 1.1rem;
            padding: 0 10px;
          }
          
          .category { 
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 16px;
          }
          
          .category-title {
            font-size: 1.3rem;
            margin-bottom: 18px;
          }
          
          .sites-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }
          
          .site-card {
            padding: 18px 10px;
            border-radius: 12px;
          }
          
          .site-icon {
            height: 55px;
            width: 55px;
            font-size: 1.8rem;
            margin-bottom: 10px;
          }
          
          .site-name {
            font-size: 0.95rem;
          }
          
          .admin-footer {
            margin-top: 40px;
            padding: 15px 0;
          }
          
          .admin-link {
            padding: 10px 20px;
            font-size: 0.9rem;
          }
        }
        
        @media (max-width: 480px) {
          body {
            padding: 12px;
          }
          
          .header h1 { 
            font-size: 1.8rem; 
          }
          
          .header p {
            font-size: 1rem;
          }
          
          .sites-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          
          .category { 
            padding: 18px 15px;
            margin-bottom: 18px;
          }
          
          .category-title {
            font-size: 1.2rem;
          }
          
          .site-card {
            padding: 16px 8px;
          }
          
          .site-icon {
            height: 50px;
            width: 50px;
            font-size: 1.6rem;
          }
          
          .site-name {
            font-size: 0.9rem;
          }
          
          .admin-link {
            width: 100%;
            max-width: 280px;
            justify-content: center;
          }
        }
        
        @media (max-width: 360px) {
          .sites-grid {
            grid-template-columns: 1fr;
          }
          
          .header h1 { 
            font-size: 1.6rem; 
          }
        }
        
        /* 超小屏幕特殊处理 */
        @media (max-width: 320px) {
          body {
            padding: 10px;
          }
          
          .category { 
            padding: 15px 12px;
          }
          
          .site-card {
            padding: 14px 6px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>我的导航页</h1>
          <p>快速访问您最常用的网站，提高工作效率</p>
        </div>
        
        <div id="categories-container">
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>加载中...</div>
          </div>
        </div>
        
        <div class="admin-footer">
          <a href="/admin" class="admin-link">
            <i class="fas fa-cog"></i> 管理面板
          </a>
        </div>
      </div>

      <script>
        // 从 KV 加载导航数据并渲染页面
        async function loadNavigationData() {
          try {
            const response = await fetch('/data');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            renderCategories(data.categories, data.sites);
          } catch (error) {
            console.error('Error loading navigation data:', error);
            // 如果获取失败，显示默认示例数据
            const defaultCategories = ['常用网站', '学习资源', '娱乐'];
            const defaultSites = [
              { name: 'GitHub', url: 'https://github.com', category: '常用网站', icon: '<i class="fab fa-github"></i>' },
              { name: 'Google', url: 'https://google.com', category: '常用网站', icon: '<i class="fab fa-google"></i>' },
              { name: 'MDN', url: 'https://developer.mozilla.org', category: '学习资源', icon: '<i class="fas fa-code"></i>' },
              { name: 'YouTube', url: 'https://youtube.com', category: '娱乐', icon: '<i class="fab fa-youtube"></i>' }
            ];
            renderCategories(defaultCategories, defaultSites);
          }
        }

        function renderCategories(categories, sites) {
          const container = document.getElementById('categories-container');
          
          if (!categories || categories.length === 0) {
            container.innerHTML = \`
              <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>暂无分类</h3>
                <p>请<a href="/admin"><i class="fas fa-cog"></i> 前往管理面板</a>添加分类和网站</p>
              </div>
            \`;
            return;
          }

          let html = '';
          categories.forEach(category => {
            const categorySites = sites.filter(site => site.category === category);
            
            if (categorySites.length === 0) return;
            
            // 为不同分类分配不同的图标
            const categoryIcons = {
              '常用网站': 'fas fa-star',
              '学习资源': 'fas fa-graduation-cap',
              '娱乐': 'fas fa-gamepad',
              '工作': 'fas fa-briefcase',
              '社交': 'fas fa-users',
              '工具': 'fas fa-tools',
              '购物': 'fas fa-shopping-bag',
              '新闻': 'fas fa-newspaper'
            };
            
            const categoryIcon = categoryIcons[category] || 'fas fa-folder';
            
            html += \`
              <div class="category">
                <div class="category-title">
                  <i class="\${categoryIcon}"></i>
                  \${category}
                </div>
                <div class="sites-grid">
                  \${categorySites.map(site => \`
                    <a href="\${site.url}" class="site-card" target="_blank" rel="noopener">
                      <div class="site-icon">\${site.icon || '<i class="fas fa-globe"></i>'}</div>
                      <div class="site-name">\${site.name}</div>
                    </a>
                  \`).join('')}
                </div>
              </div>
            \`;
          });
          
          container.innerHTML = html || \`
            <div class="empty-state">
              <i class="fas fa-globe"></i>
              <h3>暂无网站</h3>
              <p>请<a href="/admin"><i class="fas fa-cog"></i> 前往管理面板</a>添加网站</p>
            </div>
          \`;
        }

        // 页面加载完成后获取数据
        document.addEventListener('DOMContentLoaded', loadNavigationData);
      </script>
    </body>
    </html>
  `;
}

/**
 * 生成管理面板 HTML
 */
function generateAdminPage(isAuthenticated = false) {
  if (!isAuthenticated) {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>管理面板 - 我的导航页</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        
        :root {
          --primary: #6366f1;
          --primary-dark: #4f46e5;
          --secondary: #8b5cf6;
          --accent: #06b6d4;
          --light: #f8fafc;
          --dark: #1e293b;
          --gray: #64748b;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --card-bg: #ffffff;
          --shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        body { 
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
          background: var(--gradient);
          min-height: 100vh;
          padding: 20px;
          color: var(--dark);
          line-height: 1.6;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .admin-container {
          width: 100%;
          max-width: 500px;
          background: var(--card-bg);
          border-radius: 20px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        
        .admin-header {
          background: var(--gradient);
          color: white;
          padding: 30px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        
        .admin-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        .admin-header h1 { 
          font-size: 2rem; 
          margin-bottom: 10px;
          font-weight: 700;
          position: relative;
        }
        
        .admin-header p { 
          font-size: 1.1rem; 
          opacity: 0.9;
          position: relative;
        }
        
        .admin-content {
          padding: 30px;
        }
        
        .auth-section {
          text-align: center;
        }
        
        .auth-section h2 {
          margin-bottom: 25px;
          color: var(--dark);
          font-size: 1.5rem;
          font-weight: 600;
        }
        
        .password-input-container {
          position: relative;
          margin: 0 auto 20px;
        }
        
        .password-input {
          padding: 15px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          width: 100%;
          font-size: 1rem;
          transition: var(--transition);
          background: var(--light);
          padding-left: 45px;
        }
        
        .password-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        
        .password-input-container i {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray);
        }
        
        .btn {
          padding: 15px 28px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: var(--transition);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        
        .btn:hover {
          background: var(--primary-dark);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
        }
        
        .btn i {
          margin-right: 8px;
        }
        
        .message {
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: none;
          font-weight: 500;
        }
        
        .success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        
        .home-link {
          display: inline-flex;
          align-items: center;
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 20px;
          transition: var(--transition);
          padding: 10px 0;
        }
        
        .home-link:hover {
          color: var(--primary-dark);
        }
        
        .home-link i {
          margin-right: 8px;
        }
        
        /* 响应式设计 */
        @media (max-width: 480px) {
          body {
            padding: 10px;
          }
          
          .admin-header {
            padding: 25px 20px;
          }
          
          .admin-header h1 {
            font-size: 1.7rem;
          }
          
          .admin-content {
            padding: 25px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="admin-container">
        <div class="admin-header">
          <h1><i class="fas fa-cogs"></i> 导航页管理面板</h1>
          <p>请输入管理员密码</p>
        </div>
        <div class="admin-content">
          <a href="/" class="home-link">
            <i class="fas fa-arrow-left"></i> 返回首页
          </a>
          
          <div class="auth-section">
            <h2>管理员验证</h2>
            <div class="password-input-container">
              <i class="fas fa-lock"></i>
              <input type="password" id="passwordInput" class="password-input" placeholder="请输入管理员密码">
            </div>
            <button id="authBtn" class="btn">
              <i class="fas fa-sign-in-alt"></i> 登录
            </button>
            <div id="authMessage" class="message"></div>
          </div>
        </div>
      </div>

      <script>
        // 验证管理员身份
        document.getElementById('authBtn').addEventListener('click', async () => {
          const password = document.getElementById('passwordInput').value;
          const messageEl = document.getElementById('authMessage');
          
          if (!password) {
            showMessage(messageEl, '请输入密码', 'error');
            return;
          }
          
          try {
            const response = await fetch('/admin/auth', {
              method: 'POST',
              body: new URLSearchParams({ password })
            });
            
            const result = await response.json();
            
            if (result.success) {
              showMessage(messageEl, '登录成功，正在跳转...', 'success');
              setTimeout(() => {
                window.location.href = '/admin';
              }, 1000);
            } else {
              showMessage(messageEl, result.message || '验证失败', 'error');
            }
          } catch (error) {
            showMessage(messageEl, '网络错误，请重试', 'error');
          }
        });
        
        // 显示消息
        function showMessage(element, text, type) {
          element.textContent = text;
          element.className = \`message \${type}\`;
          element.style.display = 'block';
          
          setTimeout(() => {
            element.style.display = 'none';
          }, 5000);
        }
        
        // 允许按回车键提交密码
        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            document.getElementById('authBtn').click();
          }
        });
      </script>
    </body>
    </html>
    `;
  } else {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>管理面板 - 我的导航页</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        
        :root {
          --primary: #6366f1;
          --primary-dark: #4f46e5;
          --secondary: #8b5cf6;
          --accent: #06b6d4;
          --light: #f8fafc;
          --dark: #1e293b;
          --gray: #64748b;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --card-bg: #ffffff;
          --shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        body { 
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
          background: var(--gradient);
          min-height: 100vh;
          padding: 20px;
          color: var(--dark);
          line-height: 1.6;
        }
        
        .admin-container {
          max-width: 1100px;
          margin: 0 auto;
          background: var(--card-bg);
          border-radius: 20px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        
        .admin-header {
          background: var(--gradient);
          color: white;
          padding: 30px;
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .admin-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        .admin-header-content {
          position: relative;
        }
        
        .admin-header h1 { 
          font-size: 2.2rem; 
          margin-bottom: 8px;
          font-weight: 700;
        }
        
        .admin-header p { 
          font-size: 1.1rem; 
          opacity: 0.9;
        }
        
        .admin-actions {
          position: relative;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .admin-content {
          padding: 30px;
        }
        
        .management-section {
          display: block;
        }
        
        .section-title {
          font-size: 1.5rem;
          margin-bottom: 20px;
          color: var(--dark);
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 600;
        }
        
        .form-group {
          margin-bottom: 25px;
          background: var(--light);
          padding: 25px;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .form-group label {
          display: block;
          margin-bottom: 10px;
          font-weight: 600;
          color: var(--dark);
        }
        
        .form-control {
          width: 100%;
          padding: 12px 15px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 1rem;
          transition: var(--transition);
        }
        
        .form-control:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .site-item {
          background: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 15px;
          border-left: 4px solid var(--primary);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          transition: var(--transition);
        }
        
        .site-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .site-info {
          flex: 1;
          min-width: 0;
        }
        
        .site-name {
          font-weight: 600;
          font-size: 1.1rem;
          color: var(--dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 8px;
        }
        
        .site-url {
          display: block;
          color: var(--gray);
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 8px;
          max-width: 100%;
        }
        
        .site-meta {
          font-size: 0.9rem;
          color: var(--gray);
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .site-meta span {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .site-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
          margin-left: 15px;
        }
        
        .btn {
          padding: 12px 20px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          transition: var(--transition);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        
        .btn:hover {
          background: var(--primary-dark);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .btn i {
          margin-right: 5px;
        }
        
        .btn-sm {
          padding: 8px 12px;
          font-size: 0.8rem;
        }
        
        .btn-success {
          background: var(--success);
        }
        
        .btn-success:hover {
          background: #0da271;
        }
        
        .btn-warning {
          background: var(--warning);
        }
        
        .btn-warning:hover {
          background: #e68a09;
        }
        
        .btn-danger {
          background: var(--error);
        }
        
        .btn-danger:hover {
          background: #dc2626;
        }
        
        .btn-light {
          background: white;
          color: var(--dark);
          border: 1px solid #e2e8f0;
        }
        
        .btn-light:hover {
          background: #f8fafc;
          border-color: var(--primary);
          color: var(--primary);
        }
        
        .message {
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          display: none;
          font-weight: 500;
        }
        
        .success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        
        .warning {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        
        .tab-container {
          display: flex;
          margin-bottom: 25px;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
        }
        
        .tab {
          padding: 12px 24px;
          cursor: pointer;
          font-weight: 500;
          transition: var(--transition);
          border-bottom: 3px solid transparent;
          white-space: nowrap;
        }
        
        .tab.active {
          color: var(--primary);
          border-bottom: 3px solid var(--primary);
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        .home-link {
          display: inline-flex;
          align-items: center;
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 20px;
          transition: var(--transition);
          padding: 10px 0;
        }
        
        .home-link:hover {
          color: var(--primary-dark);
        }
        
        .home-link i {
          margin-right: 8px;
        }
        
        .category-tag {
          background: #e0e7ff;
          color: #4f46e5;
          padding: 10px 15px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          margin: 5px;
          white-space: nowrap;
          font-weight: 500;
        }
        
        .categories-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
          .admin-content {
            padding: 20px;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .site-item {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .site-actions {
            margin-top: 15px;
            width: 100%;
            justify-content: flex-end;
          }
          
          .tab-container {
            flex-wrap: wrap;
          }
          
          .tab {
            flex: 1;
            min-width: 120px;
            text-align: center;
          }
          
          .admin-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .admin-actions {
            margin-top: 15px;
            width: 100%;
            justify-content: space-between;
          }
          
          .site-meta {
            flex-direction: column;
            gap: 5px;
          }
        }
        
        @media (max-width: 480px) {
          body {
            padding: 10px;
          }
          
          .admin-header {
            padding: 25px 20px;
          }
          
          .admin-header h1 {
            font-size: 1.8rem;
          }
          
          .btn {
            width: 100%;
            margin-bottom: 10px;
          }
          
          .site-actions {
            flex-direction: column;
            width: 100%;
          }
          
          .form-group {
            padding: 20px 15px;
          }
          
          .categories-container {
            flex-direction: column;
          }
          
          .category-tag {
            width: 100%;
            justify-content: space-between;
          }
        }
      </style>
    </head>
    <body>
      <div class="admin-container">
        <div class="admin-header">
          <div class="admin-header-content">
            <h1><i class="fas fa-cogs"></i> 导航页管理面板</h1>
            <p>添加和管理您的网站导航</p>
          </div>
          <div class="admin-actions">
            <button id="logoutBtn" class="btn btn-light">
              <i class="fas fa-sign-out-alt"></i> 退出登录
            </button>
            <a href="/" class="btn btn-light">
              <i class="fas fa-home"></i> 返回首页
            </a>
          </div>
        </div>
        <div class="admin-content">
          <div class="management-section">
            <div class="tab-container">
              <div class="tab active" data-tab="content">内容管理</div>
              <div class="tab" data-tab="password">修改密码</div>
            </div>
            
            <div id="contentTab" class="tab-content active">
              <div class="form-group">
                <label for="newCategory">添加新分类</label>
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="newCategory" class="form-control" placeholder="输入分类名称">
                  <button id="addCategoryBtn" class="btn">
                    <i class="fas fa-plus"></i> 添加分类
                  </button>
                </div>
              </div>
              
              <div class="form-group">
                <h3 class="section-title">添加新网站</h3>
                <div class="form-row">
                  <input type="text" id="siteName" class="form-control" placeholder="网站名称">
                  <input type="text" id="siteUrl" class="form-control" placeholder="网站URL (包含 http:// 或 https://)">
                </div>
                <div class="form-row">
                  <select id="siteCategory" class="form-control">
                    <option value="">选择分类</option>
                  </select>
                  <input type="text" id="siteIcon" class="form-control" placeholder="图标 (Font Awesome 类名，如 fas fa-star)">
                </div>
                <button id="addSiteBtn" class="btn">
                  <i class="fas fa-plus"></i> 添加网站
                </button>
              </div>
              
              <div class="form-group">
                <h3 class="section-title">当前导航数据</h3>
                <div id="currentData">
                  <!-- 当前数据将通过 JavaScript 动态加载 -->
                </div>
                <button id="saveBtn" class="btn btn-success" style="margin-top: 20px;">
                  <i class="fas fa-save"></i> 保存所有更改
                </button>
              </div>
            </div>
            
            <div id="passwordTab" class="tab-content">
              <div class="form-group">
                <h3 class="section-title">修改管理员密码</h3>
                <div class="form-row">
                  <input type="password" id="currentPassword" class="form-control" placeholder="当前密码">
                  <input type="password" id="newPassword" class="form-control" placeholder="新密码">
                </div>
                <div class="form-row">
                  <input type="password" id="confirmPassword" class="form-control" placeholder="确认新密码">
                </div>
                <button id="changePasswordBtn" class="btn btn-warning">
                  <i class="fas fa-key"></i> 修改密码
                </button>
              </div>
            </div>
            
            <div id="message" class="message"></div>
          </div>
        </div>
      </div>

      <script>
        let categories = [];
        let sites = [];
        
        // 标签切换功能
        document.querySelectorAll('.tab').forEach(tab => {
          tab.addEventListener('click', () => {
            // 移除所有标签的活动状态
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // 隐藏所有标签内容
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // 激活当前标签
            tab.classList.add('active');
            // 显示当前标签内容
            const tabId = tab.getAttribute('data-tab') + 'Tab';
            document.getElementById(tabId).classList.add('active');
          });
        });
        
        // 退出登录
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          try {
            const response = await fetch('/admin/logout', {
              method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
              window.location.href = '/admin';
            }
          } catch (error) {
            console.error('Logout error:', error);
          }
        });
        
        // 添加分类
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
          const categoryName = document.getElementById('newCategory').value.trim();
          if (!categoryName) {
            alert('请输入分类名称');
            return;
          }
          
          if (!categories.includes(categoryName)) {
            categories.push(categoryName);
            updateCategorySelect();
            document.getElementById('newCategory').value = '';
            renderCurrentData();
          } else {
            alert('该分类已存在');
          }
        });
        
        // 添加网站
        document.getElementById('addSiteBtn').addEventListener('click', () => {
          const name = document.getElementById('siteName').value.trim();
          const url = document.getElementById('siteUrl').value.trim();
          const category = document.getElementById('siteCategory').value;
          const icon = document.getElementById('siteIcon').value.trim() || '<i class="fas fa-globe"></i>';
          
          if (!name || !url || !category) {
            alert('请填写完整的网站信息');
            return;
          }
          
          // 简单的 URL 验证
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('请输入有效的 URL，以 http:// 或 https:// 开头');
            return;
          }
          
          sites.push({
            name,
            url,
            category,
            icon
          });
          
          // 清空表单
          document.getElementById('siteName').value = '';
          document.getElementById('siteUrl').value = '';
          document.getElementById('siteIcon').value = '';
          
          renderCurrentData();
        });
        
        // 保存数据
        document.getElementById('saveBtn').addEventListener('click', async () => {
          try {
            const response = await fetch('/admin/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ categories, sites })
            });
            
            const result = await response.json();
            const messageEl = document.getElementById('message');
            
            if (result.success) {
              showMessage(messageEl, '数据保存成功！', 'success');
            } else {
              showMessage(messageEl, result.message || '保存失败', 'error');
            }
          } catch (error) {
            showMessage(messageEl, '网络错误，保存失败', 'error');
          }
        });
        
        // 修改密码
        document.getElementById('changePasswordBtn').addEventListener('click', async () => {
          const currentPassword = document.getElementById('currentPassword').value;
          const newPassword = document.getElementById('newPassword').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const messageEl = document.getElementById('message');
          
          if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage(messageEl, '请填写所有密码字段', 'error');
            return;
          }
          
          if (newPassword !== confirmPassword) {
            showMessage(messageEl, '新密码和确认密码不一致', 'error');
            return;
          }
          
          if (newPassword.length < 6) {
            showMessage(messageEl, '新密码长度至少为6位', 'error');
            return;
          }
          
          try {
            const response = await fetch('/admin/change-password', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            });
            
            const result = await response.json();
            
            if (result.success) {
              showMessage(messageEl, result.message, 'success');
              document.getElementById('currentPassword').value = '';
              document.getElementById('newPassword').value = '';
              document.getElementById('confirmPassword').value = '';
            } else {
              showMessage(messageEl, result.message || '修改失败', 'error');
            }
          } catch (error) {
            showMessage(messageEl, '网络错误，修改失败', 'error');
          }
        });
        
        // 更新分类选择下拉框
        function updateCategorySelect() {
          const select = document.getElementById('siteCategory');
          select.innerHTML = '<option value="">选择分类</option>';
          
          categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
          });
        }
        
        // 渲染当前数据
        function renderCurrentData() {
          const container = document.getElementById('currentData');
          
          let html = '<h4>分类:</h4>';
          if (categories.length === 0) {
            html += '<p style="padding: 15px; background: #f1f5f9; border-radius: 10px; text-align: center;">暂无分类</p>';
          } else {
            html += '<div class="categories-container">';
            categories.forEach((category, index) => {
              html += \`
                <div class="category-tag">
                  \${category}
                  <button onclick="removeCategory(\${index})" style="background: none; border: none; color: #4f46e5; margin-left: 8px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              \`;
            });
            html += '</div>';
          }
          
          html += '<h4>网站:</h4>';
          if (sites.length === 0) {
            html += '<p style="padding: 15px; background: #f1f5f9; border-radius: 10px; text-align: center;">暂无网站</p>';
          } else {
            sites.forEach((site, index) => {
              html += \`
                <div class="site-item">
                  <div class="site-info">
                    <div class="site-name">\${site.name}</div>
                    <div class="site-url">\${site.url}</div>
                    <div class="site-meta">
                      <span><i class="fas fa-folder"></i> \${site.category}</span>
                      <span><i class="fas fa-icons"></i> \${site.icon}</span>
                    </div>
                  </div>
                  <div class="site-actions">
                    <button onclick="removeSite(\${index})" class="btn btn-danger btn-sm">
                      <i class="fas fa-trash"></i> 删除
                    </button>
                  </div>
                </div>
              \`;
            });
          }
          
          container.innerHTML = html;
        }
        
        // 加载当前数据
        async function loadCurrentData() {
          try {
            const response = await fetch('/data');
            if (response.ok) {
              const data = await response.json();
              categories = data.categories || [];
              sites = data.sites || [];
            }
          } catch (error) {
            console.error('Error loading current data:', error);
          }
          
          updateCategorySelect();
          renderCurrentData();
        }
        
        // 删除分类
        window.removeCategory = function(index) {
          if (confirm('确定要删除这个分类吗？这将会删除该分类下的所有网站！')) {
            const category = categories[index];
            // 删除该分类下的所有网站
            sites = sites.filter(site => site.category !== category);
            // 删除分类
            categories.splice(index, 1);
            updateCategorySelect();
            renderCurrentData();
          }
        };
        
        // 删除网站
        window.removeSite = function(index) {
          if (confirm('确定要删除这个网站吗？')) {
            sites.splice(index, 1);
            renderCurrentData();
          }
        };
        
        // 显示消息
        function showMessage(element, text, type) {
          element.textContent = text;
          element.className = \`message \${type}\`;
          element.style.display = 'block';
          
          setTimeout(() => {
            element.style.display = 'none';
          }, 5000);
        }
        
        // 页面加载完成后获取数据
        document.addEventListener('DOMContentLoaded', loadCurrentData);
      </script>
    </body>
    </html>
  `;
  }
}