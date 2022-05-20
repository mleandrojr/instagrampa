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

export default class Logger {

    /**
     * Logger colors.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     *
     * @type {Object}
     */
    static colors = {
        Reset: "\x1b[0m",
        Bright: "\x1b[1m",
        Dim: "\x1b[2m",
        Underscore: "\x1b[4m",
        Blink: "\x1b[5m",
        Reverse: "\x1b[7m",
        Hidden: "\x1b[8m",

        FgBlack: "\x1b[30m",
        FgRed: "\x1b[31m",
        FgGreen: "\x1b[32m",
        FgYellow: "\x1b[33m",
        FgBlue: "\x1b[34m",
        FgMagenta: "\x1b[35m",
        FgCyan: "\x1b[36m",
        FgWhite: "\x1b[37m",

        BgBlack: "\x1b[40m",
        BgRed: "\x1b[41m",
        BgGreen: "\x1b[42m",
        BgYellow: "\x1b[43m",
        BgBlue: "\x1b[44m",
        BgMagenta: "\x1b[45m",
        BgCyan: "\x1b[46m",
        BgWhite: "\x1b[47m"
    }

    /**
     * Log a message and stack trace to console if the first argument is false.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static assert() {
        console.assert(...Logger.parse(...arguments));
    }

    /**
     * Clear the console.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static clear() {
        console.clear();
    }

    /**
     * Log the number of times this line has been called with the given label.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static count() {
        console.count(...arguments);
    }

    /**
     * Resets the value of the counter with the given label.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static countReset() {
        console.countReset(...arguments);
    }

    /**
     * Outputs a message to the console with the log level debug.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static debug() {
        console.debug(Logger.colors.FgCyan, ...Logger.parse(...arguments), logger.colors.Reset);
    }

    /**
     * Displays an interactive listing of the properties of a specified JavaScript object.
     * This listing lets you use disclosure triangles to examine the contents of child objects.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static dir() {
        console.dir(...arguments);
    }

    /**
     * Displays an XML/HTML Element representation of the specified object if possible
     * or the JavaScript Object view if it is not possible.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static dirxml() {
        console.dirxml(...arguments);
    }

    /**
     * Outputs an error message. You may use string substitution and additional arguments with this method.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static error() {
        console.error(Logger.colors.FgRed, ...Logger.parse(...arguments), Logger.colors.Reset);
    }

    /**
     * Creates a new inline group, indenting all following output by another level.
     * To move back out a level, call groupEnd().
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static group() {
        console.group(...arguments);
    }

    /**
     * Creates a new inline group, indenting all following output by another level.
     * However, unlike group() this starts with the inline group collapsed requiring
     * the use of a disclosure button to expand it. To move back out a level, call groupEnd().
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static groupCollapsed() {
        console.groupCollapsed(...arguments);
    }

    /**
     * Exits the current inline group.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static groupEnd() {
        console.groupEnd();
    }


    /**
     * Informative logging of information.
     * You may use string substitution and additional arguments with this method.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static info() {
        console.info(Logger.colors.FgBlue, ...Logger.parse(...arguments), Logger.colors.Reset);
    }

    /**
     * For general output of logging information.
     * You may use string substitution and additional arguments with this method.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static log() {
        console.log(Logger.colors.Reset, ...Logger.parse(...arguments));
    }

    /**
     * Displays tabular data as a table.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static table() {
        console.table(...arguments);
    }

    /**
     * Starts a timer with a name specified as an input parameter.
     * Up to 10,000 simultaneous timers can run on a given page.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static time() {
        console.time(...arguments);
    }

    /**
     * Stops the specified timer and logs the elapsed time in milliseconds since it started.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static timeEnd() {
        console.timeEnd(...arguments);
    }

    /**
     * Logs the value of the specified timer to the console.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static timeLog() {
        console.timeLog(...arguments);
    }

    /**
     * Outputs a stack trace.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static trace() {
        console.trace(...arguments);
    }

    /**
     * Outputs a warning message. You may use string substitution and additional arguments with this method.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static warn() {
        console.warn(Logger.colors.FgYellow, ...Logger.parse(...arguments), Logger.colors.Reset);
    }

    /**
     * Adds the current datetime to the message.
     *
     * @author Marcos Leandro <mleandrojr@yggdrasill.com.br>
     * @since  1.0.0
     */
    static parse() {
        return [new Date().toISOString(), ...arguments];
    }
}
