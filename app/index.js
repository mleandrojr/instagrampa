/**
 * Instagrampa
 *
 * This file is part of Instagrampa.
 * You are free to modify and share this project or its files.
 *
 * @package  instagrampa
 * @author   Marcos Leandro <mleandrojr@yggdrasill.com.br>
 * @license  GPLv3 <http://www.gnu.org/licenses/gpl-3.0.en.html>
 */

import Logger from "./helper/Logger.js";
import Puppeteer from "puppeteer";
import UserAgent from "user-agents";
import fs from "fs-extra";
import Db from "./helper/Db.js";

export default class Instagrampa {

    /**
     * Instagram base URL.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @var {string}
     */
    instagramBaseUrl = "https://www.instagram.com";

    /**
     * Instance configs.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @var {object}
     */
    configs = {};

    /**
     * Browser instance.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    browser = null;

    /**
     * Browser new page.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    page = null;

    /**
     * Instagrampa clock in.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  2022-11-29
     */
    clockIn = 0;

    /**
     * Actions counter.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    counter = {
        hourlyFollowed: 0,
        hourlyUnfollowed: 0,
        dailyFollowed: 0,
        dailyUnfollowed: 0
    }

    /**
     * DB indexes.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @var {object}
     */
    db = {
        followed: null,
        unfollowed: null
    }

    /**
     * The constructor.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {object} configs
     */
    constructor(configs) {

        this.configs = configs;

        if (!fs.existsSync(`./profiles/${this.configs.username}`)) {
            Logger.log("Creating profile directory");
            fs.mkdirSync(`./profiles/${this.configs.username}`);
        }

        this.db.followed = new Db(this.configs.username, "followed");
        this.db.unfollowed = new Db(this.configs.username, "unfollowed");
        this.clockIn = Date.now();

        setInterval(_ => {
            this.clockIn = Date.now();
        }, 86400000); /* 1 day */

        (async () => {
            try {

                for (;;) {
                    await this.run();
                }

            } catch (err) {

                Logger.error(err);

                if (this.browser) {
                    await this.browser.close();
                }
            }
        })();
    }

    /**
     * Opens and configures the browser.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async openBrowser() {

        Logger.log("Opening browser");

        try {

            this.browser = await Puppeteer.launch({ headless: false });
            if (!this.browser) {
                Logger.error("Browser not found.");
                return;
            }

            this.page = await this.browser.newPage();
            await this.page.setExtraHTTPHeaders({ "Accept-Language": "en" });

            if (this.configs.randomizeUserAgent) {
                const userAgentGenerated = new UserAgent({ deviceCategory: "desktop" });
                await this.page.setUserAgent(userAgentGenerated.toString());
            }

            await this.loadCookies();

        } catch (err) {
            return false;
        }

        return true;
    }

    /**
     * Instagrampa routines.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async run() {

        if (!this.browser) {
            await this.openBrowser();
        }

        await this.goHome();
        await this.pressButton(
            await this.page.$x("//button[contains(text(), \"Save Info\")]"), "Login info dialog: Save Info", 3000
        );

        await this.pressButton(
            await this.page.$x("//button[contains(text(), \"Not Now\")]"), "Turn on Notifications dialog", 3000
        );

        await this.saveCookies();
        await this.setLanguage("en", "English");

        if (this.configs.unfollowNonMutual) {
            await this.unfollowNonMutual();
        }

        if (this.configs.unfollowPreviouslyFollowed) {
            await this.unfollowPreviouslyFollowed();
        }

        if (this.configs.accountsToScrape.length) {
            await this.scrape();
        }

        Logger.log("Done.");
    }

    /**
     * Goes to the home page.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async goHome() {

        Logger.log("Going home.");

        await this.goto(`${this.instagramBaseUrl}/?hl=en`);

        const isUserLoggedIn = await this.isUserLoggedIn();

        if (!isUserLoggedIn) {
            await this.page.type("input[name=\"username\"]", this.configs.username, { delay: 50 });
            await this.sleep(1000);

            await this.page.type("input[name=\"password\"]", this.configs.password, { delay: 50 });
            await this.sleep(1000);

            for (;;) {
                const loginButton = (await this.page.$x("//button[@type=\"submit\"]"))[0];
                if (loginButton) {
                    await loginButton.click();
                    break;
                }

                Logger.warn(
                    "Login button not found. Maybe you can help me click it?\n\
                    And also report an issue on github with a screenshot of what you're seeing (="
                );

                await this.sleep(6000);
            }

            await this.sleep(6000);

            if (!(await this.isUserLoggedIn())) {
                throw new Error("Still not logged in. Please check your credentials and try again.");
            }
        }
    }

    /**
     * Goes to the given profile.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     */
    async gotoProfile(username) {

        if (typeof username === "undefined") {
            const myUsername = await this.page.evaluate(_ => window._sharedData.config.viewer.username);
            return this.gotoProfile(myUsername);
        }

        const pageUrl = this.page.url();
        if (pageUrl.includes(username)) {

            const closeHandler = await this.page.$x("//*[@aria-label='Close']");
            if (closeHandler.length) {
                Logger.log(`Closing any open dialogs.`);
                await closeHandler[0].click();
                await this.sleep(1000);
                return;
            }
        }

        Logger.log(`Going to profile ${username}`);
        await this.goto(`${this.instagramBaseUrl}/${username}`);
    }

    /**
     * Goto the given url.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} url   URL to be open.
     * @param {number} tries Trying number.
     */
    async goto(url, tries) {

        Logger.log(`Loading ${url}`);

        tries = tries || 0;

        const response = await this.page.goto(url);
        const status = response.status();

        if (status === 429) {
            throw new Error(
                "429 Too Many Requests could mean that Instagram suspects you're using a bot.\n\
                You could try to use the Instagram Mobile app from the same IP for a few days first"
            );
        }

        if (status === 404) {
            throw new Error(`URL ${url} returned a 404 not found.`);
        }

        await this.sleep(3000);

        const handler = await this.page.$x("//body");
        const loaded = await this.page.evaluate((element) => {

            const logoByAriaLabel = element.querySelectorAll(`[aria-label="Instagram"]`);
            const logoByAlt = element.querySelectorAll(`[alt="Instagram"]`);
            return logoByAriaLabel.length > 0 || logoByAlt.length > 0;

        }, handler[0]);

        if (!loaded && tries < 10) {
            return await this.goto(url, ++tries);
        }

        if (!loaded) {
            throw new Error(`URL ${url} cannot be loaded.`);
        }
    }

    /**
     * Unfollows who doesn't follow you back.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async unfollowNonMutual() {

        Logger.log("Unfollowing non-mutual followers.");
        const following = this.shuffle(
            this.configs.skipManuallyFollowed ? await this.getFollowingFromDb() : await this.getFollowing()
        );

        Logger.log("Accounts to verify:", following);
        for (let i = 0, length = following.length; i < length; i++) {

            try {

                const username = following[i];

                const followDb = await this.isInFollowedDb(username);
                if (followDb && parseInt(followDb) + (this.configs.daysUntilUnfollow * 60 * 60 * 24 * 1000) > +new Date()) {
                    Logger.warn(`Skipping ${username} because we followed them less than ${this.configs.daysUntilUnfollow} days ago.`);
                    continue;
                }

                await this.gotoProfile(username);

                if (await this.isAccountNotFound()) {
                    Logger.error(`Account ${username} not found. Skipping`);
                    continue;
                }

                if (await this.isAccountPrivate()) {
                    Logger.warn(`Account ${username} is private.`);
                    await this.unfollow(username);
                    await this.sleep(this.random(1000, 10000));
                    continue;
                }

                const isFollowingBack = await this.isUserFollowingBack(username);
                Logger.log(`Is ${username} following us back?`, isFollowingBack);

                if (!isFollowingBack) {
                    await this.unfollow(username);
                }

                await this.sleep(this.random(1000, 10000));

            } catch (err) {
                Logger.error(err);
            }
        }
    }

    /**
     * Unfollows previously followed accounts.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async unfollowPreviouslyFollowed() {

        Logger.log("Unfollowing previously followed accounts.");

        const followed = this.db.followed;
        Logger.log(`Found ${followed.length} followed accounts.`);

        for (let username in followed) {

            const followDb = await this.isInFollowedDb(username);
            if (followDb && parseInt(followDb) + (this.configs.daysUntilUnfollow * 60 * 60 * 24 * 1000) > +new Date()) {
                Logger.warn(`Skipping ${username} because we followed them less than ${this.configs.daysUntilUnfollow} days ago.`);
                continue;
            }

            await this.unfollow(username);
        }

        await this.sleep(1000);
    }

    /**
     * Unfollows the given user.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async unfollow(username) {

        while (!this.canFollowOrUnfollow()) {
            await this.sleep(10 * 60 * 1000);
        }

        Logger.log(`Unfollowing ${username}`);
        await this.gotoProfile(username);

        const unfollowButton = await this.findUnfollowButton();
        if (!unfollowButton) {

            const followButton = await this.findFollowButton();
            if (followButton) {
                Logger.warn(`You are not following ${username}`);
                return;
            }

            Logger.warn(`Unfollow button not found for ${username}`);
            return;
        }

        await unfollowButton.click();
        await this.sleep(3000);

        const unfollowMenuItem = await this.findUnfollowMenuItem();
        if (!unfollowMenuItem) {
            Logger.warn(`Unfollow menu item not found for ${username}`);
            return;
        }

        await unfollowMenuItem.click();
        await this.sleep(3000);

        try {
            await this.db.unfollowed.insert(username, +new Date());

        } catch (err) {
            Logger.error(`An error occurred while saving ${username} to the unfollowed database: ${err}`);
        }

        this.checkActionBlocked();
        this.incrementCounter("hourlyUnfollowed", 60 * 60 * 1000);
        this.incrementCounter("dailyUnfollowed", 60 * 60 * 24 * 1000);

        const followButton2 = await this.findFollowButton();
        if (!followButton2) {
            Logger.debug("Unfollow button did not change state");
        }

        await this.sleep(60 * 60 * 1000 / this.configs.maxFollowsPerHour, .2);
    }

    /**
     * Scrapes an user.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async scrape() {

        Logger.log("Users to follow the followers: ", this.configs.accountsToScrape);
        const users = this.shuffle(this.configs.accountsToScrape);
        const user = users[0];

        Logger.log(`User ${user} chosen to be scraped`);

        const followers = await this.getFollowers(user);
        Logger.log(`${followers.length} users found:`, followers);

        for (let i = 0, length = followers.length; i < length; i++) {

            try {

                const username = followers[i];

                if (this.isAccountIgnored(username)) {
                    Logger.warn(`${username} is in the do not follow list. Skipping.`);
                    continue;
                }

                if (await this.isInFollowedDb(username)) {
                    Logger.warn(`Skipping ${username} for already being followed before`);
                    continue;
                }

                if (await this.isInUnfollowedDb(username)) {
                    Logger.warn(`Skipping ${username} for already being unfollowed before`);
                    continue;
                }

                while (!this.canFollowOrUnfollow()) {
                    await this.sleep(10 * 60 * 1000);
                }

                await this.follow(username);
                await this.sleep(this.random(1000, 10000));

            } catch (err) {
                Logger.error(err);
            }
        }
    }

    /**
     * Follows an user.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     */
    async follow(username) {

        await this.gotoProfile(username);

        const followers = await this.getFollowersCount();
        const following = await this.getFollowingCount();
        const ratio = followers / (following || 1);

        const isProtected = this.isAccountProtected(username);

        if (isProtected) {
            Logger.log(`${username} is protected. Skipping.`);
            return;
        }

        if (this.configs.followMinFollowers !== null && followers < this.configs.followMinFollowers) {
            Logger.warn(`Account ${username} has too few followers, skipping`);
            return;
        }

        if (this.configs.followMinFollowing !== null && following < this.configs.followMinFollowing) {
            Logger.warn(`Account ${username} has too few follows, skipping`);
            return;
        }

        if (this.configs.followMaxFollowers !== null && followers > this.configs.followMaxFollowers) {
            Logger.warn(`Account ${username} has too many followers, skipping`);
            return;
        }

        if (this.configs.followMaxFollowing !== null && following > this.configs.followMaxFollowing) {
            Logger.warn(`Account ${username} has too many follows, skipping`);
            return;
        }

        if (this.configs.followRatioMin !== null && ratio < this.configs.followRatioMin) {
            Logger.warn(`Account ${username} has too many follows compared to followers, skipping`);
            return;
        }

        if (this.configs.followRatioMax !== null && ratio > this.configs.followRatioMax) {
            Logger.warn(`Account ${username} has too many followers compared to follows, skipping`);
            return;
        }

        if (this.skipPrivateAccounts() && await this.isAccountPrivate()) {
            Logger.warn(`Skipping ${username} for being a private account`);
            return;
        }

        if (this.skipEmptyAccounts() && await this.isAccountEmpty()) {
            Logger.warn(`Skipping ${username} for being an empty account`);
            return;
        }

        Logger.log(`Following ${username}`);

        const followButton = await this.findFollowButton();
        if (!followButton) {

            const unfollowButton = await this.findUnfollowButton();
            if (unfollowButton) {
                Logger.warn(`You are following ${username} already`);
                return;
            }

            Logger.error(`Follow button not found for ${username}`);
            return;
        }

        await followButton.click();

        this.checkActionBlocked();
        this.incrementCounter("hourlyFollowed", 60 * 60 * 1000);
        this.incrementCounter("dailyFollowed", 60 * 60 * 24 * 1000);

        try {
            await this.db.followed.insert(username, +new Date());

        } catch (err) {
            Logger.error(`An error occurred while saving ${username} to the followed database: ${err}`);
        }

        await this.sleep(1000);

        const followButton2 = await this.findFollowButton();
        if (followButton2) {
            Logger.warn("Follow button did not change state");
        }

        await this.sleep(60 * 60 * 1000 / this.configs.maxFollowsPerHour, .2);
    }

    /**
     * Tries to press a button.
     *
     * @author Marcos Leandro <
     * @since  1.0.0
     *
     * @param {object} handler Element handler.
     * @param {string} name    Element name.
     * @param {number} sleep   Time to sleep after the button pressing.
     */
    async pressButton(handler, name, sleep = 3000) {

        try {

            if (handler.length === 1) {
                Logger.log(`Pressing button: ${name}`);
                handler[0].click();
                await this.sleep(sleep);
            }

        } catch (err) {
            Logger.error(`Failed to press button: ${name}`);
        }
    }

    /**
     * Returns the followed users from the given username.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     *
     * @return {array}
     */
    async getFollowing(username) {

        await this.gotoProfile(username);
        await this.pressButton(
            await this.page.$x("//header//section//ul//li[3]"), "Following", 1000
        );

        let tries = 0;

        for (;;) {

            Logger.log("Waiting for the following list to load");


            const list = await this.page.$x("//div[@role='dialog']//div[@aria-labelledby]");
            if (list || tries >= 4) {
                break;
            }

            tries++;
            await this.sleep(this.random(1000, 5000));
        }

        const following = this.getUsersFromList(
            await this.getFollowingCount()
        );

        return following;
    }

    /**
     * Returns the followers from the given username.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     *
     * @return {array}
     */
    async getFollowers(username) {

        await this.gotoProfile(username);
        await this.pressButton(
            await this.page.$x("//header//section//ul//li[2]"), "Followers", 1000
        );

        let tries = 0;

        for (;;) {

            Logger.log("Waiting for the followers list to load");

            const list = await this.page.$x("//div[@role='dialog']//div[@aria-labelledby]");
            if (list || tries >= 4) {
                break;
            }

            tries++;
            await this.sleep(this.random(1000, 5000));
        }

        const followers = this.getUsersFromList(
            await this.getFollowersCount()
        );

        return followers;
    }

    /**
     * Returns the current account's following count.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {number}
     */
    async getFollowingCount() {

        const handler = await this.page.$x("//header//section//ul//li[3]");
        const following = await this.page.evaluate((element) => {
            const span = element.querySelector("span");
            const total = span?.getAttribute("title")?.replace(/[^0-9]/, "") || span?.innerText.replace(/[^0-9]/, "");
            return total;
        }, handler[0]);

        return parseInt(following);
    }

    /**
     * Returns the current account's followers count.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {number}
     */
    async getFollowersCount() {

        const handler = await this.page.$x("//header//section//ul//li[2]");
        const followers = await this.page.evaluate((element) => {

            if (typeof element === "undefined") {
                return null;
            }

            const span = element.querySelector("span");
            const total = span?.getAttribute("title")?.replace(/[^0-9]/, "") || span?.innerText.replace(/[^0-9]/, "");
            return total;
        }, handler[0]);

        return parseInt(followers);
    }

    /**
     * Returns the users from an open list.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {boolean} persistent If true, the list will be read to the end.
     *
     * @return {array}
     */
    async getUsersFromList(totalAccounts, persistent = false) {

        Logger.log(`Getting up to ${totalAccounts} accounts from list`);

        return await this.page.evaluate(async (totalAccounts, persistent) => {

            let users = [];

            try {

                await new Promise((resolve) => {

                    let scroll = 0;
                    let timer = setInterval(async () => {

                        try {

                            const scrollable = document.querySelector("div[aria-labelledby]").parentNode.parentNode.parentNode;
                            scrollable.scrollTop = scrollable.scrollHeight;

                            await new Promise(r => setTimeout(r, 1000));
                            const usersList = scrollable.querySelectorAll("div[aria-labelledby]");
                            for (let user of usersList) {
                                let username = user.querySelector("a")?.getAttribute("href")?.replaceAll("/", "");
                                if (username && !users.includes(username)) {
                                    users.push(username);
                                }
                            }

                            if (users.length >= totalAccounts) {
                                clearInterval(timer);
                                resolve();
                            }

                            /* If the list is too big, let's start a russian roullete. It'll be fun! */
                            if (!persistent && scroll > 100 && this.random(0, 10) % 3 === 0) {
                                clearInterval(timer);
                                resolve();
                            }

                            scroll++;
                            await new Promise(r => setTimeout(r, 3000));

                        } catch (err) {
                            console.error(err);
                            clearInterval(timer);
                            resolve();
                        }

                    }, 2000);
                });

            } catch (err) {}

            return users;

        }, totalAccounts, persistent);
    }

    /**
     * Returns the followed accounts from database.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {string} db Database to be used.
     *
     * @return {array}
     */
    async getFollowingFromDb() {

        const followed = await this.db.followed.getAll();
        const unfollowed = await this.db.unfollowed.getAll();
        const accounts = [];

        for (let key in followed) {
            if (unfollowed.hasOwnProperty(key) && unfollowed[key] > followed[key]) {
                continue;
            }

            accounts.push(key);
        }

        return accounts;
    }

    /**
     * Returns the follow button.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async findFollowButton() {

        const handler1 = await this.page.$x("//*[@type='button'][contains(.,'Follow')]");
        if (handler1.length > 0) {
            return handler1[0];
        }

        return null;
    }

    /**
     * Returns the unfollow button.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async findUnfollowButton() {

        const handler1 = await this.page.$x("//*[@type='button'][contains(.,'Following')]");
        if (handler1.length > 0) {
            return handler1[0];
        }

        return null;
    }

    /**
     * Returns the unfollow menu item.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  2022-12-01
     *
     * @return {object} Element handle.
     */
    async findUnfollowMenuItem() {
        const handler = await this.page.$x("//*[@role='button'][contains(.,'Unfollow')]");
        return handler[0] || null;
    }

    /**
     * Returns a button with the given text.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {string} text
     *
     * @return {object}
     */
    async findButtonWithText(text) {

        let handler = await this.page.$x(`//header//button[contains(.,"${text}")]`);
        if (handler.length > 0) {
            return handler[0];
        }

        handler = await this.page.$x(`//header//button[text()="${text}"]`);
        if (handler.length > 0) {
            return handler[0];
        }

        return undefined;
    }

    /**
     * Sets the language.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} code Language code.
     * @param {string} name Language name.
     */
    async setLanguage(code, name) {

        const handler = await this.page.$x(`//select[//option[@value="${code}" and text()="${name}"]]`);
        if (handler.length < 1) {
            throw new Error("Language selector not found");
        }

        Logger.log("Found language selector");

        if (!(await this.isLanguageActive(handler[0], code, name))) {
            optionElem.selected = true;
            const event = new Event("change", { bubbles: true });
            selectElem.dispatchEvent(event);
            await this.sleep(2000);
            return;
        }

        Logger.log(`It's already in ${name}`);
    }

    /**
     * Checks whether the Instagrampa can follow/unfollow or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    canFollowOrUnfollow() {

        const currentTime = Date.now();
        if (currentTime > this.clockIn + (this.configs.shiftHours * 24 * 60 * 60 * 1000)) {
            Logger.log("We already clocked out");
            return false;
        }

        if (this.counter.hourlyFollowed + this.counter.hourlyUnfollowed >= this.configs.maxFollowsPerHour) {
            Logger.log("We have reached hourly follow rate limit");
            return false;
        }

        if (this.counter.dailyFollowed + this.counter.dailyUnfollowed >= this.configs.maxFollowsPerDay) {
            Logger.log("We have reached daily follow rate limit");
            return false;
        }

        return true;
    }

    /**
     * Increments the given counter.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} counter
     */
    incrementCounter(counter, timeout) {

        if (this.counter.hasOwnProperty(counter)) {
            this.counter[counter]++;

            setTimeout(() => {
                this.counter[counter]--;
            }, timeout);
        }
    }

    /**
     * Returns whether the user is logged in or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    async isUserLoggedIn() {
        return (await this.page.$x("//form[@id='loginForm']")).length === 0;
    }

    /**
     * Verifies if the language is active.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {object} handler Element handler.
     * @param {string} code    Language code.
     *
     * @return {boolean}
     */
    async isLanguageActive(handler, code) {
        return await this.page.evaluate((selectElem, short) => {
            const optionElem = selectElem.querySelector(`option[value="${short}"]`);
            return optionElem.selected;
        }, handler, code)
    }

    /**
     * Checks whether the user is following back or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     */
    async isUserFollowingBack(username) {

        for (;;) {
            const followingButton = await this.page.$x("//header//section//ul//li[3]");
            if (followingButton.length) {
                followingButton[0].click();
                break;
            }

            await this.sleep(this.random(1000, 3000));
        }

        let tries = 0;

        for (;;) {

            Logger.log(`Waiting for the ${username}'s following list to load`);

            const list = await this.page.$x("//div[@role='dialog']//div[@aria-labelledby]");
            if (list.length > 0 || tries >= 4) {
                break;
            }

            tries++;
            await this.sleep(this.random(1000, 3000));
        }

        await this.sleep(this.random(1000, 3000));

        const handler = await this.page.$x("//div[@role='dialog']");
        return await this.page.evaluate((element, nickname) => {

            try {
                const firstElement = element.querySelectorAll("div[aria-labelledby]")[0];
                const anchor = firstElement.querySelector("a");
                return anchor.getAttribute("href").replaceAll("/", "") === nickname;

            } catch (err) {
                /* We will not touch this user because we got an error. */
                return true;
            }

        }, handler[0], this.configs.username);
    }

    /**
     * Returns whether the account is protected or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     *
     * @return {boolean}
     */
    isAccountProtected(username) {
        return this.configs.protectedAccounts.includes(username);
    }

    /**
     * Returns whether the account is in ignored list or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} username
     *
     * @return {boolean}
     */
    isAccountIgnored(username) {
        return this.configs.doNotFollowAccounts.includes(username);
    }

    /**
     * Returns whether the account is private or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    async isAccountPrivate() {
        const privateString = await this.page.$x("//*[text()=\"This Account is Private\"]");
        return privateString.length > 0;
    }

    /**
     * Returns whether the account is found or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    async isAccountNotFound() {
        const notFoundString = await this.page.$x("//*[text()=\"Sorry, this page isn't available.\"]");
        return notFoundString.length > 0;
    }

    /**
     * Returns whether the account is empty or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    async isAccountEmpty() {
        const emptyString = await this.page.$x("//*[text()=\"No Posts Yet\"]");
        return emptyString.length > 0;
    }

    /**
     * Returns whether the private accounts will be skipped or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    skipPrivateAccounts() {
        return this.configs.skipPrivateAccounts;
    }

    /**
     * Returns whether the empty accounts will be skipped or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    skipEmptyAccounts() {
        return this.configs.skipEmptyAccounts;
    }

    /**
     * Returns whether the action is blocked or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {boolean}
     */
    async isActionBlocked() {

        if ((await this.page.$x("//*[contains(text(), \"Action Blocked\")]")).length > 0) {
            return true;
        }

        if ((await this.page.$x("//*[contains(text(), \"Try Again Later\")]")).length > 0) {
           return true;
        }

        return false;
    }

    /**
     * Checks if the action is blocked.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async checkActionBlocked() {

        if (await this.isActionBlocked()) {
            Logger.error(`Action Blocked, waiting ${hours} hours...`);
            await this.deleteCookies();
            await this.sleep(3 * 60 * 60 * 1000);
            throw new Error("Aborted operation due to action blocked");
        }
    }

    /**
     * Returns whether the account is in followed database or not.
     *
     * @author Marcos Leandro <mleeandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {string} username
     *
     * @return {string}
     */
    async isInFollowedDb(username) {
        return await this.db.followed.get(username);
    }

    /**
     * Returns whether the account is in unfollowed database or not.
     *
     * @author Marcos Leandro <mleeandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {string} username
     *
     * @return {string}
     */
    async isInUnfollowedDb(username) {
        return await this.db.unfollowed.get(username);
    }

    /**
     * Tries to load the cookies.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async loadCookies() {

        try {

            Logger.log("Loading the cookies.");

            if (!fs.existsSync(`./profiles/${this.configs.username}/cookies.json`)) {
                Logger.log("Cookies not found.");
                return;
            }

            const cookies = JSON.parse(await fs.readFile(`./profiles/${this.configs.username}/cookies.json`));
            for (const cookie of cookies) {
                if (cookie.name !== "ig_lang") await this.page.setCookie(cookie);
            }

        } catch (err) {
            Logger.error("An error occurred while loading cookies.");
        }
    }

    /**
     * Tries to save the cookies.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async saveCookies() {

        try {

            Logger.log("Saving cookies.");

            const cookies = await this.page.cookies();
            await fs.writeFile(`./profiles/${this.configs.username}/cookies.json`, JSON.stringify(cookies));

        } catch (err) {
            Logger.error(`Failed to save cookies: ${err.message}`);
        }
    }

    /**
     * Deletes the cookies.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async deleteCookies() {

        try {
            Logger.log("Deleting cookies");
            await fs.unlink(`./profiles/${this.configs.username}/cookies.json`);

        } catch (err) {
            Logger.error("No cookies to delete");
        }
    }

    /**
     * Sleeps for a given amount of miliseconds.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {number} ms
     * @param {number} deviation
     */
    async sleep(ms, deviation = 1) {
        const miliseconds = ((Math.random() * deviation) + 1) * ms;
        const seconds =  Math.round(miliseconds / 1000);
        Logger.log(`Waiting ${seconds} ` + (seconds === 1 ? "second" : "seconds"));
        return new Promise(resolve => setTimeout(resolve, miliseconds));
    }

    /**
     * Returns a random number between the range.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {number} min
     * @param {number} max
     *
     * @return {number}
     */
    random(min = 0, max = 100) {

        const difference = max - min;
        let rand = Math.random();

        rand = Math.floor(rand * difference);
        rand = rand + min;

        return rand;
    }

    /**
     * Shuffles an array.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {array} array
     *
     * @returns {array}
     */
    shuffle(array) {

        let randomIndex;
        let currentIndex = array.length

        while (currentIndex !== 0) {

            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }

        return array;
    }
}
