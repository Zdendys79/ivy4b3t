# Implementace hostname-based ochrany proti lavině banů

## Problém:
Když je jeden FB účet zablokován, nesmí se další účty ze stejného VM (hostname) pokusit o přihlášení minimálně 40-60 minut, aby se zabránilo "lavině banů".

## Navrhované řešení:

### 1. Nová tabulka pro sledování hostname rizik
```sql
CREATE TABLE `hostname_protection` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `hostname` varchar(100) NOT NULL,
  `blocked_until` datetime NOT NULL,
  `blocked_reason` varchar(255) NOT NULL,
  `blocked_user_id` smallint(5) unsigned NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `hostname_unique` (`hostname`),
  KEY `idx_blocked_until` (`blocked_until`)
);
```

### 2. Rozšíření QueryBuilder o hostname ochranu
```javascript
// Zkontrolovat, zda je hostname v karanténě
async isHostnameBlocked(hostname) {
  const result = await this.safeQueryFirst(
    'hostname_protection.checkBlocked', 
    [hostname]
  );
  return result && new Date(result.blocked_until) > new Date();
}

// Nastavit hostname do karantény
async blockHostname(hostname, userId, reason, minutes = 60) {
  const blockedUntil = new Date(Date.now() + minutes * 60 * 1000);
  return await this.safeExecute(
    'hostname_protection.insertBlock',
    [hostname, blockedUntil, reason, userId]
  );
}

// Uvolnit hostname z karantény
async unblockHostname(hostname) {
  return await this.safeExecute(
    'hostname_protection.removeBlock',
    [hostname]
  );
}
```

### 3. SQL dotazy pro hostname ochranu
```sql
-- hostname_protection.js
export const HOSTNAME_PROTECTION = {
  checkBlocked: `
    SELECT hostname, blocked_until, blocked_reason, blocked_user_id
    FROM hostname_protection
    WHERE hostname = ? AND blocked_until > NOW()
    LIMIT 1
  `,
  
  insertBlock: `
    INSERT INTO hostname_protection (hostname, blocked_until, blocked_reason, blocked_user_id)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      blocked_until = VALUES(blocked_until),
      blocked_reason = VALUES(blocked_reason),
      blocked_user_id = VALUES(blocked_user_id)
  `,
  
  removeBlock: `
    DELETE FROM hostname_protection
    WHERE hostname = ?
  `,
  
  getActiveBlocks: `
    SELECT * FROM hostname_protection
    WHERE blocked_until > NOW()
    ORDER BY blocked_until DESC
  `
};
```

### 4. Integrace do worker.js
```javascript
// V tick() funkci před výběrem uživatele
const hostname = os.hostname();
const isBlocked = await db.isHostnameBlocked(hostname);

if (isBlocked) {
  await Log.warn('[WORKER]', `🚫 Hostname ${hostname} je zablokován do ${isBlocked.blocked_until}`);
  await Log.warn('[WORKER]', `🔒 Důvod: ${isBlocked.blocked_reason}`);
  
  // Systémový log
  await db.logSystemEvent(
    'HOSTNAME_PROTECTION',
    'WARN',
    `Hostname ${hostname} is blocked - preventing account access`,
    {
      blocked_until: isBlocked.blocked_until,
      blocked_reason: isBlocked.blocked_reason,
      blocked_user_id: isBlocked.blocked_user_id
    }
  );
  
  // Čekat s heartbeat
  await waitWithHeartbeat(5); // 5 minut
  return;
}
```

### 5. Rozšíření account lock detection
```javascript
// Když je detekován nově zablokovaný účet
async function handleNewAccountBlock(user, lockReason, lockType) {
  const hostname = os.hostname();
  
  // 1. Zablokovat účet v databázi
  await db.lockAccountWithReason(user.id, lockReason, lockType, hostname);
  
  // 2. Zalogovat do action_log
  await db.logAction(user.id, 'account_blocked', lockType, lockReason);
  
  // 3. Zalogovat do systémového logu
  await db.logSystemEvent(
    'ACCOUNT_SECURITY',
    'ERROR',
    `Account ${user.id} (${user.name} ${user.surname}) has been blocked by Facebook`,
    {
      user_id: user.id,
      hostname: hostname,
      lock_reason: lockReason,
      lock_type: lockType,
      detection_time: new Date().toISOString()
    }
  );
  
  // 4. Zablokovat hostname na 40-60 minut
  const blockMinutes = 40 + Math.random() * 20; // 40-60 minut
  await db.blockHostname(
    hostname,
    user.id,
    `Account ban detected for user ${user.id}: ${lockReason}`,
    blockMinutes
  );
  
  // 5. Další systémový log pro hostname blokaci
  await db.logSystemEvent(
    'HOSTNAME_PROTECTION',
    'WARN',
    `Hostname ${hostname} blocked for ${Math.round(blockMinutes)} minutes due to account ban`,
    {
      blocked_user_id: user.id,
      block_duration_minutes: blockMinutes,
      blocked_until: new Date(Date.now() + blockMinutes * 60 * 1000).toISOString()
    }
  );
  
  await Log.error(`[${user.id}]`, `🚨 ACCOUNT BLOCKED: ${lockReason}`);
  await Log.error('[WORKER]', `🔒 HOSTNAME ${hostname} BLOCKED for ${Math.round(blockMinutes)} minutes`);
}
```

### 6. Monitoring a reporting
```javascript
// Funkce pro zobrazení stavu hostname ochrany
async function showHostnameProtectionStatus() {
  const activeBlocks = await db.getActiveHostnameBlocks();
  
  if (activeBlocks.length > 0) {
    Log.info('[WORKER]', '🔒 Active hostname protections:');
    for (const block of activeBlocks) {
      Log.info('[WORKER]', `  ${block.hostname}: blocked until ${block.blocked_until}`);
      Log.info('[WORKER]', `    Reason: ${block.blocked_reason}`);
    }
  }
}
```

## Výhody tohoto přístupu:

1. **Automatická ochrana** - Když je účet zablokován, automaticky se chrání celý VM
2. **Konfigurovatelná doba** - 40-60 minut je nastavitelná
3. **Systémové logování** - Vše je zdokumentováno pro audit
4. **Monitoring** - Lze sledovat stav ochrany
5. **Bezpečnost** - Předchází lavině banů

## Implementace by měla být provedena v tomto pořadí:

1. Vytvořit tabulku `hostname_protection`
2. Přidat SQL dotazy do `hostname_protection.js`
3. Rozšířit QueryBuilder o hostname funkce
4. Integrovat kontrolu do `worker.js`
5. Rozšířit account lock detection
6. Otestovat na dev prostředí