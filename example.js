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

import Instagrampa from "./app/index.js";

const configs = {

    /* Instagram username */
    username: "instagramusername",

    /* Instagram password */
    password: "instagrampassword",

    /* Unfollow accounts who doesn't follow you back. */
    unfollowNonMutual: true,

    /* Unfollow previously followed accounts. */
    unfollowPreviouslyFollowed: true,

    /* Instagrampa shift hours. */
    shiftHours: 8,

    /* Amount of days to wait before unfollowing an account. */
    daysUntilUnfollow: 14,

    /* Skip accounts that were not followed by grandpa. */
    skipManuallyFollowed: true,

    /* Skip private accounts. */
    skipPrivateAccounts: true,

    /** Skip accounts with no posts. */
    skipEmptyAccounts: true,

    /* Account's Following/follows min ratio. */
    followRatioMin: 0.2,

    /* Account's Following/follows max ratio. */
    followRatioMax: 5.0,

    /* Account's minimum followers. */
    followMinFollowers: null,

    /* Account's minimum follows. */
    followMinFollowing: null,

    /* Account's maximum followers. */
    followMaxFollowers: null,

    /* Account's maximum follows. */
    followMaxFollowing: null,

    /* Randomizes the user-agent.  */
    randomizeUserAgent: true,

    /* Follow the accounts who follows these accounts. */
    accountsToScrape: [
        "account1",
        "account2",
        "account3"
    ],

    /* The accounts in protected list won't be touched. We promise. */
    protectedAccounts: [
        "account1",
        "account2",
        "account3"
    ],

    /* Accounts you don't want to follow. */
    doNotFollowAccounts: [
        "account1",
        "account2",
        "account3"
    ],

    /* Skips the accounts with these words in bio. */
    skipIfBioContains: [
        "free shipping",
        "order",
        "visa",
        "paypal",
        "bot",
        "nude",
        "forex",
        "bitcoin",
        "crypto",
        "trader",
        "investor",
        "entrepreneur",
        "finance",
        "founder"
    ],

    /*
    * This is the "do not touch" area.
    * But it's here in your config file, so do what you want 'cause a pirate is free.
    * Please be aware that you're by your own risk.
    */

    /* Maximum follows per hour. */
    maxFollowsPerHour: 20,

    /* Maximum follows per day. */
    maxFollowsPerDay: 150,

    /* Maximum likes per day. */
    maxLikesPerDay: 50
};

const instagrampa = new Instagrampa(configs);
