/**
 * instagrampa
 *
 * This file is part of Instagrampa.
 * You are free to modify and share this project or its files.
 *
 * @package  mslovelace_bot
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
        followed : null,
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

        this.run();
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
     * @author Marcos Leandro <mleandrojr@yggdrasill.com>
     * @since  1.0.0
     */
    async run() {

        try {

            if (!this.browser) {
                await this.openBrowser();
            }

            await this.goHome();
            await this.pressButton(
                await this.page.$x('//button[contains(text(), "Save Info")]'), 'Login info dialog: Save Info', 3000
            );

            await this.pressButton(
                await this.page.$x('//button[contains(text(), "Not Now")]'), 'Turn on Notifications dialog', 3000
            );

            await this.saveCookies();
            await this.setLanguage("en", "English");

            if (this.configs.unfollowNonMutual) {
                await this.unfollowNonMutual();
            }

            if (this.configs.accountsToScrape.length) {
                await this.scrape();
            }

            Logger.log("Done.");

        } catch (err) {

            Logger.error(err);

            if (this.browser) {
                await this.browser.close();
            }
        }

        // await this.run();
    }

    async test() {
        await this.follow(this.configs.username);
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
            await this.page.type('input[name="username"]', this.configs.username, { delay: 50 });
            await this.sleep(1000);

            await this.page.type('input[name="password"]', this.configs.password, { delay: 50 });
            await this.sleep(1000);

            for (;;) {
                const loginButton = (await this.page.$x("//button[.//text() = 'Log In']"))[0];
                if (loginButton) {
                    await loginButton.click();
                    break;
                }

                Logger.warn(
                    "Login button not found. Maybe you can help me click it?\n\
                    And also report an issue on github with a screenshot of what you're seeing :)"
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
            const myUsername = await this.page.evaluate(() => window._sharedData.config.viewer.username);
            return this.gotoProfile(myUsername);
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
     * @param {string} url
     */
    async goto(url) {

        Logger.log(`Loading ${url}`);

        const response = await this.page.goto(url);
        const status = response.status();

        if (status === 429) {
            throw new Error(
                "429 Too Many Requests could mean that Instagram suspects you\'re using a bot.\n\
                You could try to use the Instagram Mobile app from the same IP for a few days first"
            );
        }

        await this.sleep(3000);
    }

    /**
     * Unfollows who doesn't follow you back.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async unfollowNonMutual() {

        Logger.log("Unfollowing non-mutual followers.");

        const following = this.shuffle(await this.getFollowing());
        for (let i = 0; i < following.length; i++) {

            const username = following[i];
            const isProtected = this.isAccountProtected(username);

            if (isProtected) {
                Logger.log(`${username} is protected. Skipping.`);
                continue;
            }

            const isFollowingBack = await this.isUserFollowingBack(username);
            Logger.log(`Is ${username} following us back?`, isFollowingBack);

            if (!isFollowingBack) {
                await this.unfollow(username);
            }

            await this.sleep(this.random(1000, 10000));
        }
    }

    /**
     * Unfollows the given user.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async unfollow(username) {

        const followDb = await this.isInFollowedDb(username);
        if (followDb && parseInt(followDb) + (this.configs.daysUntilUnfollow * 60 * 60 * 24 * 1000) > +new Date()) {
            Logger.warn(`Skipping ${username} because we followed them less than ${this.configs.daysUntilUnfollow} days ago.`);
            return;
        }

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
        await this.sleep(1000);

        const confirmHandle = await this.findUnfollowConfirmButton();
        if (confirmHandle) {
            await confirmHandle.click();
            await this.sleep(60 * 60 * 1000 / this.configs.maxFollowsPerHour, .7);
        }

        this.checkActionBlocked();
        this.incrementCounter("hourlyUnfollowed", 60 * 60 * 1000);
        this.incrementCounter("dailyUnfollowed", 60 * 60 * 24 * 1000);

        try {
            await this.db.unfollowed.insert(username, +new Date());

        } catch (err) {
            Logger.error(`An error occurred while saving ${username} to the unfollowed database: ${err}`);
        }

        const followButton2 = await this.findFollowButton();
        if (!followButton2) {
            Logger.warn("Unfollow button did not change state");
        }
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

        Logger.log(`User ${user} drawn to be scraped`);

        const followers = await this.getFollowers(user);
        Logger.log(`${followers.length} users found:`, followers);

        for (let i = 0; i < followers.length; i++) {

            const username = followers[i];

            if (this.isAccountIgnored(username)) {
                Logger.log(`${username} is in the do not follow list. Skipping.`);
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
            Logger.log(`Account ${username} has too many follows compared to followers, skipping`);
            return;
        }

        if (this.configs.followRatioMax !== null && ratio > this.configs.followRatioMax) {
            Logger.log(`Account ${username} has too many followers compared to follows, skipping`);
            return;
        }

        if (this.skipPrivateAccounts() && this.isAccountPrivate()) {
            Logger.warn(`Skipping ${username} for being a private account`);
        }

        Logger.log(`Following ${username}`);

        const followButton = await this.findFollowButton();
        if (!followButton) {

            const unfollowButton = await this.findUnfollowButton();
            if (unfollowButton) {
                Logger.warn(`You are following ${username} already`);
                return;
            }

            Logger.warn(`Follow button not found for ${username}`);
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

        const followButton2 = await this.findFollowButton();
        if (followButton2) {
            Logger.warn("Follow button did not change state");
        }

        await this.sleep(60 * 60 * 1000 / this.configs.maxFollowsPerHour, .7);
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
            await this.page.$x("//header//section//ul//li[3]"), 'Following', 1000
        );

        let tries = 0;

        for (;;) {

            Logger.log("Waiting for the following list to load");

            const list = await this.page.$x("//div[@aria-label='Following']//li//a");
            if (list || tries >= 4) {
                break;
            }

            tries++;
            await this.sleep(this.random(1000, 5000));
        }

        const following = this.getUsersFromList();
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
            await this.page.$x("//header//section//ul//li[2]"), 'Followers', 1000
        );

        let tries = 0;

        for (;;) {

            Logger.log("Waiting for the followers list to load");

            const list = await this.page.$x("//div[@aria-label='Followers']//li//a");
            if (list || tries >= 4) {
                break;
            }

            tries++;
            await this.sleep(this.random(1000, 5000));
        }

        const followers = this.getUsersFromList();
        return followers;
    }

    async getFollowingCount() {

        const handler = await this.page.$x("//header//section//ul//li[3]");
        const following = await this.page.evaluate((element) => {
            return element.querySelector("span").innerText;
        }, handler[0]);

        return parseInt(following);
    }

    async getFollowersCount() {

        const handler = await this.page.$x("//header//section//ul//li[2]");
        const followers = await this.page.evaluate((element) => {
            return element.querySelector("span").innerText;
        }, handler[0]);

        return parseInt(followers);
    }

    /**
     * Returns the users from an open list.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async getUsersFromList() {

        Logger.log("Getting users from list");

        return await this.page.evaluate(async () => {

            const users = [];

            try {

                const scrollable = document.querySelector("div[role=\"dialog\"] li").closest("ul").closest("div");

                await new Promise((resolve) => {

                    let totalHeight = 0;
                    let scroll = 0;

                    let timer = setInterval(async () => {

                        try {

                            scrollable.scrollTop = scrollable.scrollHeight;
                            await new Promise(r => setTimeout(r, 100));

                            const loading = scrollable.querySelectorAll("svg[aria-label='Loading...']");
                            if (totalHeight === scrollable.scrollHeight && loading.length === 0) {
                                clearInterval(timer);
                                resolve();
                            }

                            /* If the list is too big, let's start a russian roullete. It'll be fun! */
                            if (scroll > 100 && this.random(0, 10) % 3 === 0) {
                                clearInterval(timer);
                                resolve();
                            }

                            scroll++;
                            totalHeight = scrollable.scrollHeight;
                            await new Promise(r => setTimeout(r, 3000));

                        } catch (err) {
                            clearInterval(timer);
                            resolve();
                        }

                    }, 1000);
                });

                const usersList = scrollable.querySelectorAll("li");
                for (const user of usersList) {
                    users.push(user.querySelector("a").getAttribute("href").replaceAll("/", ""));
                }

            } catch (err) {}

            return users;
        });
    }

    /**
     * Returns the follow button.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async findFollowButton() {

        const followButton = await this.findButtonWithText("Follow");
        if (followButton) {
            return followButton;
        }

        const followBackButton = await this.findButtonWithText("Follow Back");
        if (followBackButton)  {
            return followBackButton;
        }

        return undefined;
    }

    /**
     * Returns the unfollow button.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    async findUnfollowButton() {

        const handler1 = await this.page.$x("//header//button[text()='Following']");
        if (handler1.length > 0) {
            return handler1[0];
        }

        const handler2 = await this.page.$x("//header//button[text()='Requested']");
        if (handler2.length > 0) {
            return handler2[0];
        }

        const handler3 = await this.page.$x("//header//button[*//span[@aria-label='Following']]");
        if (handler3.length > 0) {
            return handler3[0];
        }

        const handler4 = await this.page.$x("//header//button[*//*[name()='svg'][@aria-label='Following']]");
        if (handler4.length > 0) {
            return handler4[0];
        }

        return undefined;
    }

    /**
     * Returns the unfollow confirm button.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @return {object} Element handler.
     */
    async findUnfollowConfirmButton() {
        const handler = await this.page.$x("//button[text()='Unfollow']");
        return handler[0];
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

        let handler = await this.page.$x(`//header//button[contains(.,'${text}')]`);
        if (handler.length > 0) {
            return handler[0];
        }

        handler = await this.page.$x(`//header//button[text()='${text}']`);
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
     * @param {*} code Language code.
     * @param {*} name Language name.
     */
    async setLanguage(code, name) {

        const handler = await this.page.$x(`//select[//option[@value='${code}' and text()='${name}']]`);
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
        return (await this.page.$x('//*[@aria-label="Home"]')).length === 1;
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
            const optionElem = selectElem.querySelector(`option[value='${short}']`);
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

        await this.gotoProfile(username);

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

            const list = await this.page.$x("//div[@role='dialog']//li");
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
                const firstElement = element.querySelectorAll("li")[0];
                const anchor = firstElement.querySelector("span a");
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
     */
    isAccountPrivate() {
        const privateString = this.page.$x("//*[text()='This Account is Private']");
        return privateString.length > 0;
    }

    /**
     * Returns whether the private accounts will be skipped or not.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    skipPrivateAccounts() {
        return this.configs.skipPrivateAccounts;
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

        if ((await this.page.$x('//*[contains(text(), "Action Blocked")]')).length > 0) {
            return true;
        }

        if ((await this.page.$x('//*[contains(text(), "Try Again Later")]')).length > 0) {
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

            const cookies = JSON.parse(await fs.readFile(`./profiles/${this.configs.username}/cookies.json`));
            for (const cookie of cookies) {
                if (cookie.name !== "ig_lang") await this.page.setCookie(cookie);
            }

        } catch (err) {
            Logger.error('No cookies found');
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
        Logger.log(`Waiting ${seconds} ` + (seconds === 1 ? 'second' : 'seconds'));
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

        while (currentIndex != 0) {

            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }

        return array;
    }
}

