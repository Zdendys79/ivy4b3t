<?php
/**
 * File: index.php
 * Location: ~/web/app/views/dashboard/index.php
 *
 * Purpose: Main dashboard page showing system overview, status cards,
 *          recent activity, and management tools.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}
?>

<div class="dashboard-container">
    <!-- Page Header -->
    <div class="dashboard-header">
        <div class="header-content">
            <div class="header-title">
                <h1>📊 Dashboard</h1>
                <p class="header-subtitle">
                    Welcome back, <?php echo htmlspecialchars($current_user['name'] ?? 'User'); ?>!
                    System overview and controls
                </p>
            </div>

            <div class="header-actions">
                <button class="btn btn-secondary" onclick="refreshDashboard()">
                    🔄 Refresh
                </button>
                <button class="btn btn-primary" onclick="showQuickActions()">
                    ⚡ Quick Actions
                </button>
            </div>
        </div>
    </div>

    <!-- Status Cards Grid -->
    <div class="status-grid">
        <!-- System Health Card -->
        <div class="status-card card-primary">
            <div class="status-card-header">
                <div class="status-icon">🔧</div>
                <div class="status-title">System Health</div>
            </div>
            <div class="status-card-body">
                <div class="status-value" id="system-health-status">
                    <?php echo ucfirst($system_health['overall'] ?? 'unknown'); ?>
                </div>
                <div class="status-description">
                    Overall system status
                </div>
            </div>
        </div>

        <!-- Active Users Card -->
        <div class="status-card card-success">
            <div class="status-card-header">
                <div class="status-icon">👥</div>
                <div class="status-title">Active Users</div>
            </div>
            <div class="status-card-body">
                <div class="status-value" id="active-users-count">
                    <?php echo htmlspecialchars($system_status['user_stats']['active_users'] ?? 0); ?>
                </div>
                <div class="status-description">
                    of <?php echo htmlspecialchars($system_status['user_stats']['total_users'] ?? 0); ?> total
                </div>
            </div>
        </div>

        <!-- Online Hosts Card -->
        <div class="status-card card-info">
            <div class="status-card-header">
                <div class="status-icon">💻</div>
                <div class="status-title">Online Hosts</div>
            </div>
            <div class="status-card-body">
                <div class="status-value" id="online-hosts-count">
                    <?php echo htmlspecialchars($system_status['active_hosts'] ?? 0); ?>
                </div>
                <div class="status-description">
                    Connected systems
                </div>
            </div>
        </div>

        <!-- Recent Actions Card -->
        <div class="status-card card-warning">
            <div class="status-card-header">
                <div class="status-icon">⚡</div>
                <div class="status-title">Recent Actions</div>
            </div>
            <div class="status-card-body">
                <div class="status-value" id="recent-actions-count">
                    <?php echo count($recent_actions ?? []); ?>
                </div>
                <div class="status-description">
                    In last hour
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content Grid -->
    <div class="dashboard-content">
        <!-- Left Column -->
        <div class="dashboard-left">
            <!-- Heartbeat Status -->
            <div class="card">
                <div class="card-header">
                    <h3>💓 Active Hosts</h3>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-secondary" onclick="refreshHeartbeats()">
                            Refresh
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="heartBeat-list" class="heartBeat-list">
                        <?php if (!empty($system_status['heartBeats'])): ?>
                            <?php foreach ($system_status['heartBeats'] as $heartBeat): ?>
                                <div class="heartBeat-item">
                                    <div class="heartBeat-host">
                                        <strong><?php echo htmlspecialchars($heartBeat['host']); ?></strong>
                                        <span class="heartBeat-status online">●</span>
                                    </div>
                                    <div class="heartBeat-details">
                                        <span class="heartBeat-user">User: <?php echo htmlspecialchars($heartBeat['user_id']); ?></span>
                                        <span class="heartBeat-time"><?php echo date('H:i:s', strtotime($heartBeat['up'])); ?></span>
                                        <span class="heartBeat-version"><?php echo htmlspecialchars($heartBeat['version'] ?? 'N/A'); ?></span>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="empty-state">
                                <div class="empty-icon">💤</div>
                                <p>No active hosts detected</p>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <!-- Monitoring & Diagnostics -->
            <div class="card">
                <div class="card-header">
                    <h3>📊 Monitoring & Diagnostics</h3>
                </div>
                <div class="card-body">
                    <div class="monitoring-grid">
                        <a href="/dont_panic" class="monitoring-link dont-panic-link">
                            <div class="monitoring-icon">
                                <img src="/public/assets/images/hitchhiker-symbol.svg" alt="Don't Panic!" style="width: 36px; height: auto; filter: invert(1);">
                            </div>
                            <div class="monitoring-title">Don't panic!</div>
                            <div class="monitoring-desc">Action log overview</div>
                        </a>
                        <a href="/test-db" class="monitoring-link">
                            <div class="monitoring-icon">🔍</div>
                            <div class="monitoring-title">DB Test</div>
                            <div class="monitoring-desc">Database diagnostics</div>
                        </a>
                        <a href="/api/status" class="monitoring-link">
                            <div class="monitoring-icon">🔌</div>
                            <div class="monitoring-title">API Status</div>
                            <div class="monitoring-desc">System status check</div>
                        </a>
                        <a href="/quotes" class="monitoring-link">
                            <div class="monitoring-icon">📝</div>
                            <div class="monitoring-title">Citáty</div>
                            <div class="monitoring-desc">Browse quotes collection</div>
                        </a>
                    </div>
                </div>
            </div>

            <!-- System Controls -->
            <div class="card">
                <div class="card-header">
                    <h3>🎛️ System Controls</h3>
                </div>
                <div class="card-body">
                    <div class="control-grid">
                        <button class="control-btn control-primary" onclick="location.href='/users'">
                            👥 Manage Users
                        </button>
                        <button class="control-btn control-secondary" onclick="location.href='/scheme'">
                            🌳 System Tree
                        </button>
                        <button class="control-btn control-secondary" onclick="location.href='/quotes'">
                            📝 Citáty
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
