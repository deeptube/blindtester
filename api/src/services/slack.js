const { stringify } = require('querystring');
const { BadRequest, Forbidden, GeneralError } = require('@feathersjs/errors');
const axios = require('axios');
const config = require('../../config');
const { addAuthenticatedSlackTeam } = require('../core/database');
const { getFileDataForUrl } = require('../core/fileFinder');

module.exports = function (app) {
  app.use('slack-oauth-slack-button', {
    async find({ query }) {
      if (config.slack.slackButtonState && (query.state !== config.slack.slackButtonState)) {
        return new Forbidden('Slack Button state is invalid');
      }

      if (query.error) {
        return new Forbidden('You have to authorize this application to access some data in order to use it');
      }

      const code = query.code;
      if (!code) {
        return new BadRequest('Missing required query params "code"');
      }

      const { data } = await axios.post(
        'https://slack.com/api/oauth.access',
        stringify({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (data.error) {
        return new GeneralError(data.error);
      }

      await addAuthenticatedSlackTeam({
        id: data.team_id,
        name: data.team_name,
        userId: data.user_id,
        token: data.access_token,
      });

      return {
        success: 'Your team can start to use this application right now!',
      };
    },
  });

  app.use('slack-command', {
    async create({ token, text, response_url, user_name }) {
      if (config.slack.verificationToken && (token !== config.slack.verificationToken)) {
        return new Forbidden('Slack verification token is invalid');
      }

      const matchedParams = text.match(
        new RegExp([
          /^/,
          /<((?:https?:\/\/)?(?:(?:www\.)?youtube\.com|youtu\.?be)\/.+)>/, // required url
          /(?: (?:"(.*?)"|(\S+)))?/, // optional difficulty
          /(?: (?:"(.*?)"|(\S+)))?/, // optional date
          /$/,
        ].map(r => r.source).join(''))
      );
      if(!matchedParams || !matchedParams[1]) {
        return {
          response_type: 'ephemeral',
          text: `Sorry, I didn't understand. Please paste a YouTube video URL and optionally include difficulty and/or date information.
Examples:
/blindtest https://www.youtube.com/watch?v=dQw4w9WgXcQ
/blindtest https://www.youtube.com/watch?v=dQw4w9WgXcQ :egg: 1992
/blindtest https://www.youtube.com/watch?v=dQw4w9WgXcQ "difficulty wrapped in double quotes" "date wrapped in double quotes"
/blindtest https://www.youtube.com/watch?v=dQw4w9WgXcQ "only difficulty"
/blindtest https://www.youtube.com/watch?v=dQw4w9WgXcQ "" "only date"
`,
        };
      }

      const { id } = await getFileDataForUrl(matchedParams[1], app);
      const difficulty = matchedParams[2] || matchedParams[3];
      const date = matchedParams[4] || matchedParams[5];
      const streamUrl = `${config.realBaseUrl}/stream/${id}`;

      // send response to response_url to avoid showing original slash command message
      axios.post(response_url, {
        response_type: 'in_channel',
        attachments: [
          {
            color: '#11aadd',
            author_name: `<@${user_name}> just slacked a new blind test`,
            title: ':point_right: CLICK HERE TO LISTEN :point_left:',
            title_link: streamUrl,
            fields: [
              ...(difficulty ? [{
                title: 'Difficulty',
                value: difficulty,
                short: true,
              }] : []),
              ...(date ? [{
                title: 'Date',
                value: date,
                short: true,
              }] : []),
            ],
            footer: 'please answer in thread to avoid spoiling everyone',
            fallback: `NEW BLIND TEST -> ${streamUrl}`,
          },
        ],
      });

      // send back ephemeral response to remove original slash command message
      return {
        response_type: 'ephemeral',
        attachments: [
          {
            color: 'good',
            text: 'Blind test successfully created',
          },
        ],
      };
    },
  });
};
