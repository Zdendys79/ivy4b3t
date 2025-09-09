/**
 * Helper pro Facebook registrační proces
 * Obsahuje kroky a návody pro ruční registraci nového FB účtu
 */

import { debugCommands } from './debug_helper.js';
import { Log } from './libs/iv_log.class.js';

export class FBRegistrationHelper {
  
  /**
   * Krok 1: Navigace na registrační stránku
   */
  static async step1_navigateToRegistration() {
    Log.info('[FB_REG]', '1️⃣ Navigace na Facebook registraci...');
    
    try {
      const result = await debugCommands.navigate('https://www.facebook.com/');
      Log.success('[FB_REG]', `✅ Stránka načtena: ${result.title}`);
      
      // Najdi registrační formulář
      const signupElements = await debugCommands.findElements('[data-testid="open-registration-form-button"], [data-testid="reg-form"], #reg_box, .registration_container');
      
      if (signupElements.count > 0) {
        Log.success('[FB_REG]', `📝 Nalezen registrační formulář: ${signupElements.count} prvků`);
        return { success: true, formFound: true, elements: signupElements.elements };
      } else {
        Log.info('[FB_REG]', '🔍 Registrační formulář není viditelný, zkouším kliknout na "Create account"');
        
        const createAccountButtons = await debugCommands.findElements('a[data-testid="open-registration-form-button"], a[href*="register"], .reg_link, [data-testid="signup-link"]');
        
        return { 
          success: true, 
          formFound: false, 
          signupButtons: createAccountButtons.elements,
          instruction: 'Klikni na tlačítko pro vytvoření účtu'
        };
      }
      
    } catch (err) {
      Log.error('[FB_REG]', `❌ Chyba při navigaci: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Krok 2: Otevření registračního formuláře
   */
  static async step2_openRegistrationForm() {
    Log.info('[FB_REG]', '2️⃣ Otevírám registrační formulář...');
    
    try {
      // Zkus najít a kliknout na "Create account" tlačítko
      const buttons = await debugCommands.findElements('[data-testid="open-registration-form-button"], a[href*="register"], .reg_link, [data-testid="signup-link"]');
      
      if (buttons.count > 0) {
        const firstButton = buttons.elements[0];
        Log.info('[FB_REG]', `🖱️ Klikám na: ${firstButton.textContent}`);
        
        // Klikni na první nalezené tlačítko
        if (firstButton.id) {
          await debugCommands.clickElement(`#${firstButton.id}`);
        } else if (firstButton.className) {
          await debugCommands.clickElement(`.${firstButton.className.split(' ')[0]}`);
        } else {
          await debugCommands.clickElement('[data-testid="open-registration-form-button"]');
        }
        
        // Čekej 2 sekundy na načtení formuláře
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Zkontroluj jestli se formulář zobrazil
        const formElements = await debugCommands.findElements('input[name="firstname"], input[name="lastname"], [data-testid="reg_first_name"], [data-testid="reg_last_name"]');
        
        return {
          success: true,
          formOpened: formElements.count > 0,
          formElements: formElements.elements
        };
        
      } else {
        return { 
          success: false, 
          error: 'Nenalezeno tlačítko pro otevření registrace',
          instruction: 'Zkus najít link "Create account" nebo "Sign up" ručně'
        };
      }
      
    } catch (err) {
      Log.error('[FB_REG]', `❌ Chyba při otevírání formuláře: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Krok 3: Analýza registračního formuláře
   */
  static async step3_analyzeRegistrationForm() {
    Log.info('[FB_REG]', '3️⃣ Analyzuji registrační formulář...');
    
    try {
      // Najdi všechny inputy v registračním formuláři
      const inputs = await debugCommands.findElements('input[type="text"], input[type="email"], input[type="password"], select');
      
      const formAnalysis = {
        totalInputs: inputs.count,
        inputs: inputs.elements.map(el => ({
          name: el.name || el.id,
          type: el.type,
          placeholder: el.placeholder,
          ariaLabel: el.ariaLabel,
          required: el.required
        }))
      };
      
      Log.info('[FB_REG]', `📋 Nalezeno ${inputs.count} input polí`);
      
      return {
        success: true,
        analysis: formAnalysis,
        nextSteps: [
          '1. Vyplň jméno a příjmení',
          '2. Zadej email nebo telefon', 
          '3. Vytvoř silné heslo',
          '4. Nastav datum narození',
          '5. Vyber pohlaví'
        ]
      };
      
    } catch (err) {
      Log.error('[FB_REG]', `❌ Chyba při analýze formuláře: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Krok 4: Vyplnění základních údajů (interaktivní)
   */
  static async step4_fillBasicInfo(userData) {
    Log.info('[FB_REG]', '4️⃣ Vyplňuji základní údaje...');
    
    try {
      const results = {};
      
      // Jméno
      if (userData.firstName) {
        try {
          await debugCommands.typeText('input[name="firstname"], [data-testid="reg_first_name"]', userData.firstName);
          results.firstName = 'OK';
        } catch (err) {
          results.firstName = `ERROR: ${err.message}`;
        }
      }
      
      // Příjmení
      if (userData.lastName) {
        try {
          await debugCommands.typeText('input[name="lastname"], [data-testid="reg_last_name"]', userData.lastName);
          results.lastName = 'OK';
        } catch (err) {
          results.lastName = `ERROR: ${err.message}`;
        }
      }
      
      // Email
      if (userData.email) {
        try {
          await debugCommands.typeText('input[name="reg_email__"], input[name="email"]', userData.email);
          results.email = 'OK';
        } catch (err) {
          results.email = `ERROR: ${err.message}`;
        }
      }
      
      // Heslo
      if (userData.password) {
        try {
          await debugCommands.typeText('input[name="reg_passwd__"], input[name="password"]', userData.password);
          results.password = 'OK';
        } catch (err) {
          results.password = `ERROR: ${err.message}`;
        }
      }
      
      return {
        success: true,
        results: results,
        nextStep: 'Nastav datum narození a pohlaví ručně, pak pokračuj na krok 5'
      };
      
    } catch (err) {
      Log.error('[FB_REG]', `❌ Chyba při vyplňování: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Krok 5: Dokončení registrace
   */
  static async step5_submitRegistration() {
    Log.info('[FB_REG]', '5️⃣ Pokus o dokončení registrace...');
    
    try {
      // Najdi submit tlačítko
      const submitButtons = await debugCommands.findElements('button[name="websubmit"], button[type="submit"], [data-testid="registration-submit"], .registration_submit');
      
      if (submitButtons.count > 0) {
        return {
          success: true,
          submitButtonFound: true,
          buttons: submitButtons.elements,
          instruction: 'POZOR: Před kliknutím zkontroluj všechny údaje! Pak klikni na registrační tlačítko ručně.'
        };
      } else {
        return {
          success: false,
          error: 'Nenalezeno submit tlačítko',
          instruction: 'Hledej tlačítko "Sign up" nebo "Create account" ručně'
        };
      }
      
    } catch (err) {
      Log.error('[FB_REG]', `❌ Chyba při hledání submit tlačítka: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Analýza aktuální stránky
   */
  static async analyzeCurrentPage() {
    try {
      const pageInfo = await debugCommands.getPageInfo();
      const domAnalysis = await debugCommands.analyzeDom();
      
      return {
        success: true,
        page: pageInfo,
        dom: domAnalysis
      };
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}