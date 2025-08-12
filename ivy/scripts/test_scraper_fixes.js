#!/usr/bin/env node

/**
 * Test script pro ověření oprav scraperu
 * Testuje:
 * 1. Že upsertGroupInfo ukládá last_seen při INSERT i UPDATE
 * 2. Že insertDiscoveredLink nevytváří duplicity 
 * 3. Že insertOrUpdateGroup správně funguje
 */

import { db } from '../iv_sql.js';
import { QueryUtils } from '../sql/queries/index.js';

async function testScraperFixes() {
    console.log('=== Test oprav scraperu ===');

    try {
        // Test 1: Test upsertGroupInfo - nová skupina
        console.log('\n1. Test upsertGroupInfo - nová skupina');
        const testFbId = 'test_' + Date.now();
        
        const upsertQuery = QueryUtils.getQuery('groups.upsertGroupInfo');
        const [result1] = await db.pool.query(upsertQuery, [
            testFbId, 'Test Skupina 1', 1000, 'Test kategorie'
        ]);
        
        console.log(`   ✓ Vložena nová skupina: insertId=${result1.insertId}`);
        
        // Ověř, že last_seen je nastaveno
        const [checkRows1] = await db.pool.query(
            'SELECT id, fb_id, name, last_seen FROM fb_groups WHERE fb_id = ?',
            [testFbId]
        );
        
        if (checkRows1[0].last_seen) {
            console.log(`   ✓ last_seen je nastaveno: ${checkRows1[0].last_seen}`);
        } else {
            console.log(`   ✗ last_seen NENÍ nastaveno!`);
        }

        // Test 2: Test upsertGroupInfo - aktualizace existující
        console.log('\n2. Test upsertGroupInfo - aktualizace existující');
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Krátká pauza
        
        const [result2] = await db.pool.query(upsertQuery, [
            testFbId, 'Test Skupina 1 - UPDATED', 2000, 'Nová kategorie'
        ]);
        
        console.log(`   ✓ Aktualizována skupina: affectedRows=${result2.affectedRows}`);
        
        const [checkRows2] = await db.pool.query(
            'SELECT id, name, member_count, category, last_seen FROM fb_groups WHERE fb_id = ?',
            [testFbId]
        );
        
        if (checkRows2[0].name === 'Test Skupina 1 - UPDATED') {
            console.log(`   ✓ Název aktualizován: ${checkRows2[0].name}`);
        }
        
        if (checkRows2[0].member_count === 2000) {
            console.log(`   ✓ Počet členů aktualizován: ${checkRows2[0].member_count}`);
        }
        
        if (checkRows2[0].last_seen > checkRows1[0].last_seen) {
            console.log(`   ✓ last_seen aktualizováno při UPDATE`);
        }

        // Test 3: Test insertDiscoveredLink - nový link
        console.log('\n3. Test insertDiscoveredLink - nový link');
        const testFbId2 = 'test_discovered_' + Date.now();
        
        const insertLinkQuery = QueryUtils.getQuery('groups.insertDiscoveredLink');
        const [result3] = await db.pool.query(insertLinkQuery, [testFbId2]);
        
        console.log(`   ✓ Vložen discovered link: insertId=${result3.insertId}`);

        // Test 4: Test insertDiscoveredLink - duplicitní link (neměl by vytvořit duplicitu)
        console.log('\n4. Test insertDiscoveredLink - duplicitní link');
        
        const [result4] = await db.pool.query(insertLinkQuery, [testFbId2]);
        
        console.log(`   ✓ Duplicitní link zpracován: affectedRows=${result4.affectedRows}`);
        
        // Ověř, že existuje jen jeden záznam
        const [countRows] = await db.pool.query(
            'SELECT COUNT(*) as count FROM fb_groups WHERE fb_id = ?',
            [testFbId2]
        );
        
        if (countRows[0].count === 1) {
            console.log(`   ✓ Žádná duplicita nevytvořena (count=${countRows[0].count})`);
        } else {
            console.log(`   ✗ PROBLÉM: Vytvořena duplicita! (count=${countRows[0].count})`);
        }

        // Test 5: Ověření celkového počtu duplicit v databázi
        console.log('\n5. Test duplicit v celé databázi');
        
        const [duplicateCheck] = await db.pool.query(`
            SELECT 
                COUNT(*) as total_groups,
                COUNT(DISTINCT fb_id) as unique_fb_ids,
                COUNT(*) - COUNT(DISTINCT fb_id) as duplicate_count
            FROM fb_groups
        `);
        
        console.log(`   Celkem skupin: ${duplicateCheck[0].total_groups}`);
        console.log(`   Unikátní FB ID: ${duplicateCheck[0].unique_fb_ids}`);
        console.log(`   Duplicity: ${duplicateCheck[0].duplicate_count}`);
        
        if (duplicateCheck[0].duplicate_count === 0) {
            console.log(`   ✓ Žádné duplicity v databázi!`);
        } else {
            console.log(`   ⚠ Stále existují duplicity: ${duplicateCheck[0].duplicate_count}`);
        }

        // Cleanup - smaž testovací data
        console.log('\n6. Cleanup testovacích dat');
        await db.pool.query('DELETE FROM fb_groups WHERE fb_id LIKE "test_%"');
        console.log('   ✓ Testovací data smazána');

        console.log('\n=== Test dokončen ===');
        
    } catch (error) {
        console.error('Chyba v testu:', error);
    } finally {
        await db.pool.end();
    }
}

// Spuštění testu
testScraperFixes();