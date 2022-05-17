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

import fs from "fs-extra";

export default class Db {

    /**
     * Current file path.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @var {string}
     */
    path = null;

    /**
     * The constructor.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {String} profile
     * @param  {string} filename
     */
    constructor(profile, filename) {
        this.path = `./profiles/${profile}/${filename}.json`;
        if (!fs.existsSync(this.path)) {
            fs.writeFileSync(
                this.path, JSON.stringify({}), { encoding: "utf8", flag: "w" }
            );
        }
    }

    /**
     * Gets a row from the database.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param  {string} key
     *
     * @return {string}
     */
    async get(key) {

        const rows = await this.read();
        if (rows.hasOwnProperty(key)) {
            return rows[key];
        }

        return null;
    }

    /**
     * Inserts a new row to the file.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} key
     * @param {string} value
     */
    async insert(key, value) {

        const rows = await this.read();
        if (rows.hasOwnProperty(key)) {
            return false;
        }

        rows[key] = value;
        await this.write(rows);
    }

    /**
     * Inserts a row.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} key
     * @param {string} value
     */
    async update(key, value) {

        const rows = await this.read();
        if (rows.hasOwnProperty(key)) {
            rows[key] = value;
            await this.write(rows);
            return true;
        }

        return false;
    }

    /**
     * Deletes a row.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {string} key
     */
    async delete(key) {

        const rows = this.read();
        if (rows.hasOwnProperty(key)) {
            delete rows[key];
            await this.write(rows);
            return true;
        }

        return false;
    }

    /**
     * Reads the contents from the file.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @returns
     */
    async read() {

        let rows = {};

        try {

            rows = JSON.parse(
                await fs.readFile(this.path)
            );

        } catch (err) {
            throw new Error(err);
        }

        return rows;
    }

    /**
     * Writes a new content to the file.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @param {object} content
     */
    async write(content) {
        await fs.writeFile(
            this.path, JSON.stringify(content), { encoding: "utf8", flag: "w" }
        );
    }
}
