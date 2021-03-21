/*

    This file is an edited copy of Androz2091/discord-player - /src/Player.js
    made to work with npm module "slash-create".

    To use this, replace everything in Player.js with the content of this file after forking the repository.

*/

const ytdl = require('discord-ytdl-core')
const Discord = require('discord.js')
const ytsr = require('youtube-sr').default
const spotify = require('spotify-url-info')
const soundcloud = require('soundcloud-scraper')
const ms = require('parse-ms')
const Queue = require('./Queue')
const Track = require('./Track')
const Util = require('./Util')
const { EventEmitter } = require('events')
const Client = new soundcloud.Client()
const { VimeoExtractor, DiscordExtractor, FacebookExtractor, ReverbnationExtractor } = require('./Extractors/Extractor')

/**
 * @typedef Filters
 * @property {boolean} [bassboost=false] Whether the bassboost filter is enabled.
 * @property {boolean} [8D=false] Whether the 8D filter is enabled.
 * @property {boolean} [vaporwave=false] Whether the vaporwave filter is enabled.
 * @property {boolean} [nightcore=false] Whether the nightcore filter is enabled.
 * @property {boolean} [phaser=false] Whether the phaser filter is enabled.
 * @property {boolean} [tremolo=false] Whether the tremolo filter is enabled.
 * @property {boolean} [vibrato=false] Whether the vibrato filter is enabled.
 * @property {boolean} [reverse=false] Whether the reverse filter is enabled.
 * @property {boolean} [treble=false] Whether the treble filter is enabled.
 * @property {boolean} [normalizer=false] Whether the normalizer filter is enabled.
 * @property {boolean} [surrounding=false] Whether the surrounding filter is enabled.
 * @property {boolean} [pulsator=false] Whether the pulsator filter is enabled.
 * @property {boolean} [subboost=false] Whether the subboost filter is enabled.
 * @property {boolean} [karaoke=false] Whether the karaoke filter is enabled.
 * @property {boolean} [flanger=false] Whether the flanger filter is enabled.
 * @property {boolean} [gate=false] Whether the gate filter is enabled.
 * @property {boolean} [haas=false] Whether the haas filter is enabled.
 * @property {boolean} [mcompand=false] Whether the mcompand filter is enabled.
 * @property {boolean} [mono=false] Whether the mono output is enabled.
 * @property {boolean} [mstlr=false] Whether M/S signal to L/R signal converter is enabled.
 * @property {boolean} [mstrr=false] Whether M/S signal to R/R signal converter is enabled.
 * @property {boolean} [compressor=false] Whether compressor filter is enabled.
 * @property {boolean} [expander=false] Whether expander filter is enabled.
 * @property {boolean} [softlimiter=false] Whether softlimiter filter is enabled.
 * @property {boolean} [chorus=false] Whether chorus (single delay) filter is enabled.
 * @property {boolean} [chorus2d=false] Whether chorus2d (two delays) filter is enabled.
 * @property {boolean} [chorus3d=false] Whether chorus3d (three delays) filter is enabled.
 * @property {boolean} [fadein=false] Whether fadein filter is enabled.
 */

const filters = {
    bassboost: 'bass=g=20',
    '8D': 'apulsator=hz=0.09',
    vaporwave: 'aresample=48000,asetrate=48000*0.8',
    nightcore: 'aresample=48000,asetrate=48000*1.25',
    phaser: 'aphaser=in_gain=0.4',
    tremolo: 'tremolo',
    vibrato: 'vibrato=f=6.5',
    reverse: 'areverse',
    treble: 'treble=g=5',
    normalizer: 'dynaudnorm=g=101',
    surrounding: 'surround',
    pulsator: 'apulsator=hz=1',
    subboost: 'asubboost',
    karaoke: 'stereotools=mlev=0.03',
    flanger: 'flanger',
    gate: 'agate',
    haas: 'haas',
    mcompand: 'mcompand',
    mono: 'pan=mono|c0=.5*c0+.5*c1',
    mstlr: 'stereotools=mode=ms>lr',
    mstrr: 'stereotools=mode=ms>rr',
    compressor: 'compand=points=-80/-105|-62/-80|-15.4/-15.4|0/-12|20/-7.6',
    expander: 'compand=attacks=0:points=-80/-169|-54/-80|-49.5/-64.6|-41.1/-41.1|-25.8/-15|-10.8/-4.5|0/0|20/8.3',
    softlimiter: 'compand=attacks=0:points=-80/-80|-12.4/-12.4|-6/-8|0/-6.8|20/-2.8',
    chorus: 'chorus=0.7:0.9:55:0.4:0.25:2',
    chorus2d: 'chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3',
    chorus3d: 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3',
    fadein: 'afade=t=in:ss=0:d=10'
}

/**
 * @typedef PlayerOptions
 * @property {boolean} [leaveOnEnd=true] Whether the bot should leave the current voice channel when the queue ends.
 * @property {number} [leaveOnEndCooldown=0] Used when leaveOnEnd is enabled, to let the time to users to add new tracks.
 * @property {boolean} [leaveOnStop=true] Whether the bot should leave the current voice channel when the stop() function is used.
 * @property {boolean} [leaveOnEmpty=true] Whether the bot should leave the voice channel if there is no more member in it.
 * @property {number} [leaveOnEmptyCooldown=0] Used when leaveOnEmpty is enabled, to let the time to users to come back in the voice channel.
 * @property {boolean} [autoSelfDeaf=true] Whether the bot should automatically turn off its headphones when joining a voice channel.
 * @property {string} [quality='high'] Music quality (high or low)
 * @property {boolean} [enableLive=false] If it should enable live contents
 * @property {object} [ytdlRequestOptions={}] YTDL request options to use cookies, proxy etc..
 */

/**
 * Default options for the player
 * @ignore
 * @type {PlayerOptions}
 */
const defaultPlayerOptions = {
    leaveOnEnd: true,
    leaveOnStop: true,
    leaveOnEmpty: true,
    leaveOnEmptyCooldown: 0,
    autoSelfDeaf: true,
    quality: 'high',
    enableLive: false,
    ytdlRequestOptions: {}
}

class Player extends EventEmitter {
    /**
     * @param {Discord.Client} client Discord.js client
     * @param {PlayerOptions} options Player options
     */
    constructor (client, options = {}) {
        if (!client) throw new SyntaxError('Invalid Discord client')
        super()

        /**
         * Utilities
         * @type {Util}
         */
        this.util = Util
        this.util.checkFFMPEG()

        /**
         * Discord.js client instance
         * @type {Discord.Client}
         */
        this.client = client
        /**
         * Player queues
         * @type {Discord.Collection<Discord.Snowflake, Queue>}
         */
        this.queues = new Discord.Collection()
        /**
         * Player options
         * @type {PlayerOptions}
         */
        this.options = defaultPlayerOptions
        for (const prop in options) {
            this.options[prop] = options[prop]
        }
        /**
         * Default filters for the queues created with this player.
         * @type {Filters}
         */
        this.filters = filters

        // Listener to check if the channel is empty
        client.on('voiceStateUpdate', (oldState, newState) => this._handleVoiceStateUpdate(oldState, newState))

        /**
         * @private
         * @type {Discord.Collection<string, Discord.Collector>}
         */
        this._resultsCollectors = new Discord.Collection()

        /**
         * @private
         * @type {Discord.Collection<string, Timeout>}
         */
        this._cooldownsTimeout = new Discord.Collection()
    }

    /**
     * Returns all the available audio filters
     * @type {Filters}
     * @example const filters = require('discord-player').Player.AudioFilters
     * console.log(`There are ${Object.keys(filters).length} filters!`)
     */
    static get AudioFilters () {
        return filters
    }

    /**
     * @ignore
     * @param {String} query
     */
    resolveQueryType (query, forceType) {
        if (forceType && typeof forceType === 'string') return forceType

        if (this.util.isSpotifyLink(query)) {
            return 'spotify-song'
        } else if (this.util.isYTPlaylistLink(query)) {
            return 'youtube-playlist'
        } else if (this.util.isYTVideoLink(query)) {
            return 'youtube-video'
        } else if (this.util.isSoundcloudLink(query)) {
            return 'soundcloud-song'
        } else if (this.util.isSpotifyPLLink(query)) {
            return 'spotify-playlist'
        } else if (this.util.isVimeoLink(query)) {
            return 'vimeo'
        } else if (FacebookExtractor.validateURL(query)) {
            return 'facebook'
        } else if (this.util.isReverbnationLink(query)) {
            return 'reverbnation'
        } else if (this.util.isDiscordAttachment(query)) {
            return 'attachment'
        } else {
            return 'youtube-video-keywords'
        }
    }

    /**
     * Search tracks
     * @ignore
     * @param {Discord.Interaction} ctx
     * @param {string} query
     * @param {boolean} firstResult
     * @param {boolean} isAttachment
     * @returns {Promise<Track>}
     */
    _searchTracks (ctx, query, firstResult, isAttachment) {
        const channel = this.client.channels.cache.find(id => ctx.channelID)
        return new Promise(async (resolve) => {
            let tracks = []
            let updatedQuery = null

            let queryType = this.resolveQueryType(query)

            if (queryType === 'spotify-song') {
                const matchSpotifyURL = query.match(/https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:track\/|\?uri=spotify:track:)((\w|-){22})/)
                if (matchSpotifyURL) {
                    const spotifyData = await spotify.getPreview(query).catch(() => {})
                    if (spotifyData) {
                        updatedQuery = `${spotifyData.artist} - ${spotifyData.title}`
                        queryType = 'youtube-video-keywords'
                    }
                }
            } else if (queryType === 'soundcloud-song') {
                const data = await Client.getSongInfo(query).catch(() => { })
                if (data) {
                    const track = new Track({
                        title: data.title,
                        url: data.url,
                        lengthSeconds: data.duration / 1000,
                        description: data.description,
                        thumbnail: data.thumbnail,
                        views: data.playCount,
                        author: data.author
                    }, ctx.user, this)

                    Object.defineProperty(track, 'soundcloud', {
                        get: () => data
                    })

                    tracks.push(track)
                }
            } else if (queryType === 'vimeo') {
                const data = await VimeoExtractor.getInfo(this.util.getVimeoID(query)).catch(e => {})
                if (!data) return this.emit('noResults', ctx, query)

                const track = new Track({
                    title: data.title,
                    url: data.url,
                    thumbnail: data.thumbnail,
                    lengthSeconds: data.duration,
                    description: '',
                    views: 0,
                    author: data.author
                }, ctx.user, this)

                Object.defineProperties(track, {
                    arbitrary: {
                        get: () => true
                    },
                    stream: {
                        get: () => data.stream.url
                    }
                })

                tracks.push(track)
            } else if (queryType === 'facebook') {
                const data = await FacebookExtractor.getInfo(query).catch(e => {})
                if (!data) return this.emit('noResults', ctx, query)
                if (data.live && !this.options.enableLive) return this.emit('error', 'LiveVideo', ctx)

                const track = new Track({
                    title: data.title,
                    url: data.url,
                    thumbnail: data.thumbnail,
                    lengthSeconds: data.duration,
                    description: data.description,
                    views: data.views || data.interactionCount,
                    author: data.author
                }, ctx.user, this)

                Object.defineProperties(track, {
                    arbitrary: {
                        get: () => true
                    },
                    stream: {
                        get: () => data.streamURL
                    }
                })

                tracks.push(track)
            } else if (queryType === 'reverbnation') {
                const data = await ReverbnationExtractor.getInfo(query).catch(() => {})
                if (!data) return this.emit('noResults', ctx, query)

                const track = new Track({
                    title: data.title,
                    url: data.url,
                    thumbnail: data.thumbnail,
                    lengthSeconds: data.duration / 1000,
                    description: '',
                    views: 0,
                    author: data.artist
                }, ctx.user, this)

                Object.defineProperties(track, {
                    arbitrary: {
                        get: () => true
                    },
                    stream: {
                        get: () => data.streamURL
                    }
                })

                tracks.push(track)
            } else if (!!isAttachment || queryType === 'attachment') {
                const data = await DiscordExtractor.getInfo(query).catch(() => {})
                if (!data || !(data.format.startsWith('audio/') || data.format.startsWith('video/'))) return this.emit('noResults', ctx, query)

                const track = new Track({
                    title: data.title,
                    url: query,
                    thumbnail: '',
                    lengthSeconds: 0,
                    description: '',
                    views: 0,
                    author: {
                        name: 'Media Attachment'
                    }
                }, ctx.user, this)

                Object.defineProperties(track, {
                    arbitrary: {
                        get: () => true
                    },
                    stream: {
                        get: () => query
                    }
                })

                tracks.push(track)
            }

            if (queryType === 'youtube-video-keywords') {
                await ytsr.search(updatedQuery || query, { type: 'video' }).then((results) => {
                    if (results && results.length !== 0) {
                        tracks = results.map((r) => new Track(r, ctx.user, this))
                    }
                }).catch(() => {})
            }

            if (tracks.length === 0) return this.emit('noResults', ctx, query)

            if (firstResult) return resolve(tracks[0])

            const collectorString = `${ctx.user.id}${ctx.channelID}`
            const currentCollector = this._resultsCollectors.get(collectorString)
            if (currentCollector) currentCollector.stop()

            const collector = channel.createMessageCollector((m) => m.author.id === ctx.user.id, {
                time: 60000,
                errors: ['time']
            })
            this._resultsCollectors.set(collectorString, collector)

            this.emit('searchResults', ctx, query, tracks, collector)

            collector.on('collect', ({ content }) => {
                if (!isNaN(content) && parseInt(content) >= 1 && parseInt(content) <= tracks.length) {
                    const index = parseInt(content, 10)
                    const track = tracks[index - 1]
                    collector.stop()
                    resolve(track)
                } else {
                    this.emit('searchInvalidResponse', ctx, query, tracks, content, collector)
                }
            })
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    this.emit('searchCancel', ctx, query, tracks)
                }
            })
        })
    }

    /**
     * Change the filters.
     * @param {Discord.Interaction} ctx
     * @param {Partial<Filters>} newFilters The filters to update and their new status.
     * @example
     * client.player.setFilters(ctx, {
     *  bassboost: true
     * });
     */
    setFilters (ctx, newFilters) {
        return new Promise((resolve, reject) => {
            // Get guild queue
            const queue = this.queues.find((g) => g.guildID === ctx.guildID)
            if (!queue) this.emit('error', 'NotPlaying', ctx)
            Object.keys(newFilters).forEach((filterName) => {
                queue.filters[filterName] = newFilters[filterName]
            })
            this._playYTDLStream(queue, true).then(() => {
                resolve()
            })
        })
    }

    /**
     * Sets currently playing music duration
     * @param {Discord.Interaction} ctx Discord interaction
     * @param {number} time Time in ms
     * @returns {Promise<void>}
     */
    setPosition (ctx, time) {
        return new Promise((resolve) => {
            const queue = this.queues.find((g) => g.guildID === ctx.guildID)
            if (!queue) return this.emit('error', 'NotPlaying', ctx)

            if (typeof time !== 'number' && !isNaN(time)) time = parseInt(time)
            if (queue.playing.durationMS === time) return this.skip(ctx)
            if (queue.voiceConnection.dispatcher.streamTime === time || (queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime) === time) return resolve()
            if (time < 0) this._playYTDLStream(queue, false).then(() => resolve())

            this._playYTDLStream(queue, false, time)
                .then(() => resolve())
        })
    }

    /**
     * Sets currently playing music duration
     * @param {Discord.Interaction} ctx Discord interaction
     * @param {number} time Time in ms
     * @returns {Promise<void>}
     */
    seek (ctx, time) {
        return this.setPosition(ctx, time)
    }

    /**
     * Check whether there is a music played in the server
     * @param {Discord.Interaction} ctx
     */
    isPlaying (ctx) {
        return this.queues.some((g) => g.guildID === ctx.guildID)
    }

    /**
     * Moves to new voice channel
     * @param {Discord.Interaction} ctx Interaction
     * @param {Discord.VoiceChannel} channel Voice channel
     * @returns {boolean} Whether it succeed or not
     */
    moveTo (ctx, channel) {
        if (!channel || channel.type !== 'voice') return
        const queue = this.queues.find((g) => g.guildID === ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        if (queue.voiceConnection.channel.id === channel.id) return

        queue.voiceConnection.dispatcher.pause()
        channel.join()
            .then(() => queue.voiceConnection.dispatcher.resume())
            .catch(() => this.emit('error', 'UnableToJoin', ctx))

        return true
    }

    /**
     * Add a track to the queue
     * @ignore
     * @param {Discord.Interaction} ctx
     * @param {Track} track
     * @returns {Queue}
     */
    _addTrackToQueue (ctx, track) {
        const queue = this.getQueue(ctx)
        if (!queue) this.emit('error', 'NotPlaying', ctx)
        if (!track || !(track instanceof Track)) throw new Error('No track to add to the queue specified')
        queue.tracks.push(track)
        return queue
    }

    /**
     * Add multiple tracks to the queue
     * @ignore
     * @param {Discord.Interaction} ctx
     * @param {Track[]} tracks
     * @returns {Queue}
     */
    _addTracksToQueue (ctx, tracks) {
        const queue = this.getQueue(ctx)
        if (!queue) throw new Error('Cannot add tracks to queue because no song is currently played on the server.')
        queue.tracks.push(...tracks)
        return queue
    }

    /**
     * Create a new queue and play the first track
     * @ignore
     * @param {Discord.Interaction} ctx
     * @param {Track} track
     * @returns {Promise<Queue>}
     */
    _createQueue (ctx, track) {
        return new Promise((resolve, reject) => {
            const guildObject = this.client.guilds.cache.find(g => g.id === ctx.guildID)
            const memberObject = guildObject.members.cache.find(m => m.id === ctx.user.id)
            const channel = memberObject.voice ? memberObject.voice.channel : null
            if (!channel) return this.emit('error', 'NotConnected', ctx)
            const queue = new Queue(ctx.guildID, ctx, this.filters)
            this.queues.set(ctx.guildID, queue)
            channel.join().then((connection) => {
                queue.voiceConnection = connection
                if (this.options.autoSelfDeaf) connection.voice.setSelfDeaf(true)
                queue.tracks.push(track)
                this.emit('queueCreate', ctx, queue)
                resolve(queue)
                this._playTrack(queue, true)
            }).catch((err) => {
                console.error(err)
                this.queues.delete(ctx.guildID)
                this.emit('error', 'UnableToJoin', ctx)
            })
        })
    }

    /**
     * Handle playlist by fetching the tracks and adding them to the queue
     * @ignore
     * @param {Discord.Interaction} ctx
     * @param {String} query
     */
    async _handlePlaylist (ctx, query) {
        this.emit('playlistParseStart', {}, ctx)
        const playlist = await ytsr.getPlaylist(query)
        if (!playlist) return this.emit('noResults', ctx, query)
        playlist.tracks = playlist.videos.map((item) => new Track(item, ctx.user, this, true))
        playlist.duration = playlist.tracks.reduce((prev, next) => prev + next.duration, 0)
        playlist.thumbnail = playlist.tracks[0].thumbnail
        playlist.requestedBy = ctx.user

        this.emit('playlistParseEnd', playlist, ctx)

        if (this.isPlaying(ctx)) {
            const queue = this._addTracksToQueue(ctx, playlist.tracks)
            this.emit('playlistAdd', ctx, queue, playlist)
        } else {
            const track = playlist.tracks.shift()
            const queue = await this._createQueue(ctx, track).catch((e) => this.emit('error', e, ctx))
            this.emit('playlistAdd', ctx, queue, playlist)
            this.emit('trackStart', ctx, queue.tracks[0], queue)
            this._addTracksToQueue(ctx, playlist.tracks)
        }
    }

    async _handleSpotifyPlaylist (ctx, query) {
        this.emit('playlistParseStart', {}, ctx)
        const playlist = await spotify.getData(query)
        if (!playlist) return this.emit('noResults', ctx, query)
        const tracks = []
        let s = 0
        for (let i = 0; i < playlist.tracks.items.length; i++) {
            const query = `${playlist.tracks.items[i].track.artists[0].name} - ${playlist.tracks.items[i].track.name}`
            const results = await ytsr.search(query, { type: 'video', limit: 1 })
            if (results.length < 1) {
                s++ // could be used later for skipped tracks due to result not being found
                continue
            }
            tracks.push(results[0])
        }
        playlist.tracks = tracks.map((item) => new Track(item, ctx.user))
        playlist.duration = playlist.tracks.reduce((prev, next) => prev + next.duration, 0)
        playlist.thumbnail = playlist.images[0].url
        playlist.requestedBy = ctx.user

        this.emit('playlistParseEnd', playlist, ctx)
        if (this.isPlaying(ctx)) {
            const queue = this._addTracksToQueue(ctx, playlist.tracks)
            this.emit('playlistAdd', ctx, queue, playlist)
        } else {
            const track = playlist.tracks.shift()
            const queue = await this._createQueue(ctx, track).catch((e) => this.emit('error', e, ctx))
            this.emit('trackStart', ctx, queue.tracks[0], queue)
            this._addTracksToQueue(ctx, playlist.tracks)
        }
    }

    async _handleSpotifyAlbum (ctx, query) {
        const album = await spotify.getData(query)
        if (!album) return this.emit('noResults', ctx, query)
        const tracks = []
        let s = 0
        for (let i = 0; i < album.tracks.items.length; i++) {
            const query = `${album.tracks.items[i].artists[0].name} - ${album.tracks.items[i].name}`
            const results = await ytsr.search(query, { type: 'video' })
            if (results.length < 1) {
                s++ // could be used later for skipped tracks due to result not being found
                continue
            }
            tracks.push(results[0])
        }

        album.tracks = tracks.map((item) => new Track(item, ctx.user))
        album.duration = album.tracks.reduce((prev, next) => prev + next.duration, 0)
        album.thumbnail = album.images[0].url
        album.requestedBy = ctx.user
        if (this.isPlaying(ctx)) {
            const queue = this._addTracksToQueue(ctx, album.tracks)
            this.emit('playlistAdd', ctx, queue, album)
        } else {
            const track = album.tracks.shift()
            const queue = await this._createQueue(ctx, track).catch((e) => this.emit('error', e, ctx))
            this.emit('trackStart', ctx, queue.tracks[0], queue)
            this._addTracksToQueue(ctx, album.tracks)
        }
    }

    async _handleSoundCloudPlaylist (ctx, query) {
        const data = await Client.getPlaylist(query).catch(() => {})
        if (!data) return this.emit('noResults', ctx, query)

        const res = {
            id: data.id,
            title: data.title,
            tracks: [],
            author: data.author,
            duration: 0,
            thumbnail: data.thumbnail,
            requestedBy: ctx.user
        }

        this.emit('playlistParseStart', res, ctx)

        for (let i = 0; i < data.tracks.length; i++) {
            const song = data.tracks[i]

            const r = new Track({
                title: song.title,
                url: song.url,
                lengthSeconds: song.duration / 1000,
                description: song.description,
                thumbnail: song.thumbnail || 'https://soundcloud.com/pwa-icon-192.png',
                views: song.playCount || 0,
                author: song.author || data.author
            }, ctx.user, this, true)

            Object.defineProperty(r, 'soundcloud', {
                get: () => song
            })

            res.tracks.push(r)
        }

        if (!res.tracks.length) {
            this.emit('playlistParseEnd', res, ctx)
            return this.emit('error', 'ParseError', ctx)
        }

        res.duration = res.tracks.reduce((a, c) => a + c.lengthSeconds, 0)

        this.emit('playlistParseEnd', res, ctx)
        if (this.isPlaying(ctx)) {
            const queue = this._addTracksToQueue(ctx, res.tracks)
            this.emit('playlistAdd', ctx, queue, res)
        } else {
            const track = res.tracks.shift()
            const queue = await this._createQueue(ctx, track).catch((e) => this.emit('error', e, ctx))
            this.emit('trackStart', ctx, queue.tracks[0], queue)
            this._addTracksToQueue(ctx, res.tracks)
        }
    }

    /**
     * Custom search function
     * @param {string} query Search query
     * @param {("youtube"|"soundcloud")} type Search type
     * @returns {Promise<any[]>}
     */
    async search (query, type = 'youtube') {
        if (!query || typeof query !== 'string') return []

        switch (type.toLowerCase()) {
        case 'soundcloud':
            return await Client.search(query, 'track').catch(() => {}) || []
        default:
            return await ytsr.search(query, { type: 'video' }).catch(() => {}) || []
        }
    }

    /**
     * Play a track in the server. Supported query types are `keywords`, `YouTube video links`, `YouTube playlists links`, `Spotify track link` or `SoundCloud song link`.
     * @param {Discord.Interaction} ctx Discord `interaction`
     * @param {String|Track} query Search query or a valid `Track` object.
     * @param {boolean} firstResult Whether the bot should play the first song found on youtube with the given query
     * @param {boolean} [isAttachment=false] If it should play it as attachment
     * @returns {Promise<void>}
     *
     * @example
     * client.player.play(ctx, "Despacito", true);
     */
    async play (ctx, query, firstResult = false, isAttachment = false) {
        if (this._cooldownsTimeout.has(`end_${ctx.guildID}`)) {
            clearTimeout(this._cooldownsTimeout.get(`end_${ctx.guildID}`))
            this._cooldownsTimeout.delete(`end_${ctx.guildID}`)
        }

        if (!query || typeof query !== 'string') throw new Error('Play function requires search query but received none!')

        // clean query
        query = query.replace(/<(.+)>/g, '$1')

        if (!this.util.isDiscordAttachment(query) && !isAttachment && this.util.isYTPlaylistLink(query)) {
            return this._handlePlaylist(ctx, query)
        }
        if (this.util.isSpotifyPLLink(query)) {
            return this._handleSpotifyPlaylist(ctx, query)
        }
        if (this.util.isSpotifyAlbumLink(query)) {
            return this._handleSpotifyAlbum(ctx, query)
        }
        if (this.util.isSoundcloudPlaylist(query)) {
            return this._handleSoundCloudPlaylist(ctx, query)
        }

        let trackToPlay
        if (query instanceof Track) {
            trackToPlay = query
        } else if (this.util.isYTVideoLink(query)) {
            const videoData = await ytdl.getBasicInfo(query)
            if (videoData.videoDetails.isLiveContent && !this.options.enableLive) return this.emit('error', 'LiveVideo', ctx)
            const lastThumbnail = videoData.videoDetails.thumbnails.length - 1 /* get the highest quality thumbnail */
            trackToPlay = new Track({
                title: videoData.videoDetails.title,
                url: videoData.videoDetails.video_url,
                views: videoData.videoDetails.viewCount,
                thumbnail: videoData.videoDetails.thumbnails[lastThumbnail],
                lengthSeconds: videoData.videoDetails.lengthSeconds,
                description: videoData.videoDetails.description,
                author: {
                    name: videoData.videoDetails.author.name
                }
            }, ctx.user, this)
        } else {
            trackToPlay = await this._searchTracks(ctx, query, firstResult, !!isAttachment || this.util.isDiscordAttachment(query))
        }
        if (trackToPlay) {
            if (this.isPlaying(ctx)) {
                const queue = this._addTrackToQueue(ctx, trackToPlay)
                this.emit('trackAdd', ctx, queue, queue.tracks[queue.tracks.length - 1])
            } else {
                const queue = await this._createQueue(ctx, trackToPlay)
                this.emit('trackStart', ctx, queue.tracks[0], queue)
            }
        }
    }

    /**
     * Pause the music in the server.
     * @param {Discord.Interaction} ctx
     * @returns {boolean} Whether it succeed or not
     * @example
     * client.player.pause(ctx);
     */
    pause (ctx) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        // Pause the dispatcher
        queue.voiceConnection.dispatcher.pause()
        queue.paused = true
        return true
    }

    /**
     * Resume the music in the server.
     * @param {Discord.Interaction} ctx
     * @returns {boolean} Whether it succeed or not
     * @example
     * client.player.resume(ctx);
     */
    resume (ctx) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        // Resume the dispatcher
        queue.voiceConnection.dispatcher.resume()
        queue.paused = false
        return true
    }

    /**
     * Stop the music in the server.
     * @param {Discord.Interaction} ctx
     * @returns {boolean} Whether it succeed or not
     * @example
     * client.player.stop(ctx);
     */
    stop (ctx) {
        // Get guild queue
        const queue = this.queues.find((g) => g.guildID === ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        // Stop the dispatcher
        queue.stopped = true
        queue.tracks = []
        if (queue.stream) queue.stream.destroy()
        queue.voiceConnection.dispatcher.end()
        if (this.options.leaveOnStop) queue.voiceConnection.channel.leave()
        this.queues.delete(ctx.guildID)
        return true
    }

    /**
     * Change the server volume.
     * @param {Discord.Interaction} ctx
     * @param {number} percent
     * @returns {boolean} Whether it succeed or not
     * @example
     * client.player.setVolume(ctx, 90);
     */
    setVolume (ctx, percent) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        // Update volume
        queue.volume = percent
        queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200)
        return true
    }

    /**
     * Get the server queue.
     * @param {Discord.Interaction} ctx
     * @returns {Queue}
     */
    getQueue (ctx) {
        // Gets guild queue
        const queue = this.queues.get(ctx.guildID)
        return queue
    }

    /**
     * Clears the server queue.
     * @param {Discord.Interaction} ctx
     */
    clearQueue (ctx) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        // Clear queue
        queue.tracks = queue.playing ? [queue.playing] : []
    }

    /**
     * Skips to the next song.
     * @param {Discord.Interaction} ctx
     * @returns {boolean} Whether it succeeds or not
     */
    skip (ctx) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        // End the dispatcher
        queue.voiceConnection.dispatcher.end()
        queue.lastSkipped = true
        // Return the queue
        return true
    }

    /**
     * Play back the previous song.
     * @param {Discord.Interaction} ctx
     * @returns {boolean} Whether it succeed or not
     */
    back (ctx) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) {
            this.emit('error', 'NotPlaying', ctx)
            return false
        }
        if (!queue.voiceConnection || !queue.voiceConnection.dispatcher) {
            this.emit('error', 'MusicStarting', ctx)
            return false
        }
        queue.tracks.splice(1, 0, queue.previousTracks.shift())
        // End the dispatcher
        queue.voiceConnection.dispatcher.end()
        queue.lastSkipped = true
        // Return the queue
        return true
    }

    /**
     * Get the played song in the server.
     * @param {Discord.Interaction} ctx
     * @returns {Track}
     */
    nowPlaying (ctx) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        const currentTrack = queue.tracks[0]
        // Return the current track
        return currentTrack
    }

    /**
     * Enable or disable repeat mode in the server.
     * @param {Discord.Interaction} ctx
     * @param {boolean} enabled
     * @returns {boolean} whether the repeat mode is now enabled.
     */
    setRepeatMode (ctx, enabled) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        // Enable/Disable repeat mode
        queue.repeatMode = enabled
        // Return the repeat mode
        return queue.repeatMode
    }

    /**
     * Set loop mode, to play the queue again and again
     * @param {Discord.Interaction} ctx
     * @param {boolean} enabled
     */
    async setLoopMode (ctx, enabled) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        // Enable/Disable loop mode
        queue.loopMode = enabled
        // Return the repeat mode
        return queue.loopMode
    }

    /**
     * Shuffle the queue of the server.
     * @param {Discord.Interaction} ctx
     * @returns {Queue}
     */
    shuffle (ctx) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        // Shuffle the queue (except the first track)
        const currentTrack = queue.tracks.shift()

        // Durstenfeld shuffle algorithm
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]]
        }

        queue.tracks.unshift(currentTrack)
        // Return the queue
        return queue
    }

    /**
     * Remove a track from the queue of the server
     * @param {Discord.Interaction} ctx
     * @param {Track|number} track
     * @returns {Track} the removed track
     */
    remove (ctx, track) {
        // Get guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return this.emit('error', 'NotPlaying', ctx)
        // Remove the track from the queue
        let trackFound = null
        if (typeof track === 'number') {
            trackFound = queue.tracks[track]
            if (trackFound) {
                queue.tracks = queue.tracks.filter((t) => t !== trackFound)
            }
        } else {
            trackFound = queue.tracks.find((s) => s === track)
            if (trackFound) {
                queue.tracks = queue.tracks.filter((s) => s !== trackFound)
            }
        }
        // Resolve
        return trackFound
    }

    /**
     * Create a progress bar for the queue of the server.
     * @param {Discord.Interaction} ctx
     * @param {Object} [options]
     * @param {boolean} [options.timecodes] Whether or not to show timecodes in the progress bar
     * @param {boolean} [options.queue] Whether to show the progress bar for the whole queue (if false, only the current song)
     * @returns {string}
     */
    createProgressBar (ctx, options) {
        // Gets guild queue
        const queue = this.queues.get(ctx.guildID)
        if (!queue) return
        const timecodes = options && typeof options === 'object' ? options.timecodes : false
        // Stream time of the dispatcher
        const previousTracksTime = queue.previousTracks.length > 0 ? queue.previousTracks.map((t) => t.durationMS).reduce((p, c) => p + c) : 0
        const currentStreamTime = options && options.queue ? previousTracksTime + queue.currentStreamTime : queue.currentStreamTime
        // Total stream time
        const totalTracksTime = queue.totalTime
        const totalTime = options && options.queue ? previousTracksTime + totalTracksTime : queue.playing.durationMS
        // Stream progress
        const index = Math.round((currentStreamTime / totalTime) * 15)
        // conditions
        if ((index >= 1) && (index <= 15)) {
            const bar = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬'.split('')
            bar.splice(index, 0, '🔘')
            if (timecodes) {
                const currentTimecode = Util.buildTimecode(ms(currentStreamTime))
                const endTimecode = Util.buildTimecode(ms(totalTime))
                return `${currentTimecode} ┃ ${bar.join('')} ┃ ${endTimecode}`
            } else {
                return `${bar.join('')}`
            }
        } else {
            if (timecodes) {
                const currentTimecode = Util.buildTimecode(ms(currentStreamTime))
                const endTimecode = Util.buildTimecode(ms(totalTime))
                return `${currentTimecode} ┃ 🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ┃ ${endTimecode}`
            } else {
                return '🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬'
            }
        }
    }

    /**
     * Handle voiceStateUpdate event.
     * @param {Discord.VoiceState} oldState
     * @param {Discord.VoiceState} newState
     */
    _handleVoiceStateUpdate (oldState, newState) {
        // Search for a queue for this channel
        const queue = this.queues.find((g) => g.guildID === oldState.guild.id)
        if (!queue) return

        // if the bot has been kicked from the channel, destroy ytdl stream and remove the queue
        if (newState.member.id === this.client.user.id && !newState.channelID) {
            queue.stream.destroy()
            this.queues.delete(newState.guild.id)
            this.emit('botDisconnect', queue.firstMessage)
        }

        // check if the bot is in a channel
        if (!queue.voiceConnection || !queue.voiceConnection.channel) return
        // process leaveOnEmpty checks
        if (!this.options.leaveOnEmpty) return
        // If the member joins a voice channel
        if (!oldState.channelID || newState.channelID) {
            const emptyTimeout = this._cooldownsTimeout.get(`empty_${oldState.guild.id}`)
            const channelEmpty = this.util.isVoiceEmpty(queue.voiceConnection.channel)
            if (!channelEmpty && emptyTimeout) {
                clearTimeout(emptyTimeout)
                this._cooldownsTimeout.delete(`empty_${oldState.guild.id}`)
            }
        } else {
            // If the channel is not empty
            if (!this.util.isVoiceEmpty(queue.voiceConnection.channel)) return
            const timeout = setTimeout(() => {
                if (!this.util.isVoiceEmpty(queue.voiceConnection.channel)) return
                if (!this.queues.has(queue.guildID)) return
                // Disconnect from the voice channel
                queue.voiceConnection.channel.leave()
                // Delete the queue
                this.queues.delete(queue.guildID)
                // Emit end event
                this.emit('channelEmpty', queue.firstMessage, queue)
            }, this.options.leaveOnEmptyCooldown || 0)
            this._cooldownsTimeout.set(`empty_${oldState.guild.id}`, timeout)
        }
    }

    _playYTDLStream (queue, updateFilter, seek) {
        return new Promise(async (resolve) => {
            const ffmeg = this.util.checkFFMPEG()
            if (!ffmeg) return
            const seekTime = typeof seek === 'number' ? seek : updateFilter ? queue.voiceConnection.dispatcher.streamTime + queue.additionalStreamTime : undefined
            const encoderArgsFilters = []
            Object.keys(queue.filters).forEach((filterName) => {
                if (queue.filters[filterName]) {
                    encoderArgsFilters.push(this.filters[filterName])
                }
            })
            let encoderArgs
            if (encoderArgsFilters.length < 1) {
                encoderArgs = []
            } else {
                encoderArgs = ['-af', encoderArgsFilters.join(',')]
            }

            let newStream
            if (!queue.playing.soundcloud && !queue.playing.arbitrary) {
                newStream = ytdl(queue.playing.url, {
                    quality: this.options.quality === 'low' ? 'lowestaudio' : 'highestaudio',
                    filter: 'audioonly',
                    opusEncoded: true,
                    encoderArgs,
                    seek: seekTime / 1000,
                    highWaterMark: 1 << 25,
                    requestOptions: this.options.ytdlRequestOptions || {}
                })
            } else {
                newStream = ytdl.arbitraryStream(queue.playing.soundcloud ? await queue.playing.soundcloud.downloadProgressive() : queue.playing.stream, {
                    opusEncoded: true,
                    encoderArgs,
                    seek: seekTime / 1000
                })
            }

            setTimeout(() => {
                if (queue.stream) queue.stream.destroy()
                queue.stream = newStream
                queue.voiceConnection.play(newStream, {
                    type: 'opus',
                    bitrate: 'auto'
                })
                if (seekTime) {
                    queue.additionalStreamTime = seekTime
                }
                queue.voiceConnection.dispatcher.setVolumeLogarithmic(queue.calculatedVolume / 200)
                // When the track starts
                queue.voiceConnection.dispatcher.on('start', () => {
                    resolve()
                })
                // When the track ends
                queue.voiceConnection.dispatcher.on('finish', () => {
                    // Reset streamTime
                    queue.additionalStreamTime = 0
                    // Play the next track
                    return this._playTrack(queue, false)
                })
                newStream.on('error', (error) => {
                    if (error.message.includes('Video unavailable')) {
                        this.emit('error', 'VideoUnavailable', queue.firstMessage, queue.playing)
                        this._playTrack(queue, false)
                    } else {
                        this.emit('error', error, queue.firstMessage)
                    }
                })
            }, 1000)
        })
    }

    /**
     *
     * @param {Queue} queue The queue to play.
     * @param {*} firstPlay
     */
    async _playTrack (queue, firstPlay) {
        if (queue.stopped) return
        // If there isn't next music in the queue
        if (queue.tracks.length === 1 && !queue.loopMode && !queue.repeatMode && !firstPlay) {
            // Leave the voice channel
            if (this.options.leaveOnEnd && !queue.stopped) {
                // Remove the guild from the guilds list
                this.queues.delete(queue.guildID)
                const timeout = setTimeout(() => {
                    queue.voiceConnection.channel.leave()
                }, this.options.leaveOnEndCooldown || 0)
                this._cooldownsTimeout.set(`end_${queue.guildID}`, timeout)
            }
            // Remove the guild from the guilds list
            this.queues.delete(queue.guildID)
            // Emit stop event
            if (queue.stopped) {
                return this.emit('musicStop')
            }
            // Emit end event
            return this.emit('queueEnd', queue.firstMessage, queue)
        }
        // if the track needs to be the next one
        if (!queue.repeatMode && !firstPlay) {
            const oldTrack = queue.tracks.shift()
            if (queue.loopMode) queue.tracks.push(oldTrack) // add the track at the end of the queue
            queue.previousTracks.push(oldTrack)
        }
        const track = queue.playing
        // Reset lastSkipped state
        queue.lastSkipped = false
        this._playYTDLStream(queue, false).then(() => {
            if (!firstPlay) this.emit('trackStart', queue.firstMessage, track, queue)
        })
    }
};

module.exports = Player

/**
 * Emitted when a track starts
 * @event Player#trackStart
 * @param {Discord.Interaction} ctx
 * @param {Track} track
 * @param {Queue} queue
 */

/**
 * Emitted when a playlist is started
 * @event Player#queueCreate
 * @param {Discord.Interaction} ctx
 * @param {Queue} queue
 */

/**
 * Emitted when the bot is awaiting search results
 * @event Player#searchResults
 * @param {Discord.Interaction} ctx
 * @param {string} query
 * @param {Track[]} tracks
 * @param {Discord.Collector} collector
 */

/**
 * Emitted when the user has sent an invalid response for search results
 * @event Player#searchInvalidResponse
 * @param {Discord.Interaction} ctx
 * @param {string} query
 * @param {Track[]} tracks
 * @param {string} invalidResponse
 * @param {Discord.MessageCollector} collector
 */

/**
 * Emitted when the bot has stopped awaiting search results (timeout)
 * @event Player#searchCancel
 * @param {Discord.Interaction} ctx
 * @param {string} query
 * @param {Track[]} tracks
 */

/**
 * Emitted when the bot can't find related results to the query
 * @event Player#noResults
 * @param {Discord.Interaction} ctx
 * @param {string} query
 */

/**
 * Emitted when the bot is disconnected from the channel
 * @event Player#botDisconnect
 * @param {Discord.Interaction} ctx
 */

/**
 * Emitted when the channel of the bot is empty
 * @event Player#channelEmpty
 * @param {Discord.Interaction} ctx
 * @param {Queue} queue
 */

/**
 * Emitted when the queue of the server is ended
 * @event Player#queueEnd
 * @param {Discord.Interaction} ctx
 * @param {Queue} queue
 */

/**
 * Emitted when a track is added to the queue
 * @event Player#trackAdd
 * @param {Discord.Interaction} ctx
 * @param {Queue} queue
 * @param {Track} track
 */

/**
 * Emitted when a playlist is added to the queue
 * @event Player#playlistAdd
 * @param {Discord.Interaction} ctx
 * @param {Queue} queue
 * @param {Object} playlist
 */

/**
 * Emitted when an error is triggered
 * @event Player#error
 * @param {string} error It can be `NotConnected`, `UnableToJoin`, `NotPlaying`, `ParseError`, `LiveVideo` or `VideoUnavailable`.
 * @param {Discord.Interaction} ctx
 */

/**
 * Emitted when discord-player attempts to parse playlist contents (mostly soundcloud playlists)
 * @event Player#playlistParseStart
 * @param {Object} playlist Raw playlist (unparsed)
 * @param {Discord.Interaction} ctx The interaction
 */

/**
 * Emitted when discord-player finishes parsing playlist contents (mostly soundcloud playlists)
 * @event Player#playlistParseEnd
 * @param {Object} playlist The playlist data (parsed)
 * @param {Discord.Interaction} ctx The interaction
 */
