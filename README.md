# Instagrampa

An Instagram bot that doesn't use the GraphQL API.
This bot is highly inspired by [mifi/instauto](https://github.com/mifi/instauto), which I really like and recommend.

The only reason I created Instagrampa is because I can no longer access the GraphQL API.

## Installing

Instagrampa uses node.js in version 8 or higher.
To install dependencies, you need to run npm.

    npm install

## Using

You need to create a copy of the example.js file with your Instagram account settings and define the routines you want to run. For example:

    cp example.js myaccount.js

After this process, just run the newly created file.

    node myaccount.js

A Chromium browser window will open and Instagrampa will start working.
