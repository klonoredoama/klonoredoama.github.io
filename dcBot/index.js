import http from 'http';
import "dotenv/config";
import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder,
  Events
} from "discord.js";
import { JSDOM } from "jsdom";

// --- Web Server for Render (Prevents Port Timeout) ---
http.createServer((req, res) => {
  res.write('Bot is alive');
  res.end();
}).listen(process.env.PORT || 8080, '0.0.0.0');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Fuzzy Search Logic ---
function getSimilarity(s1, s2) {
    let longer = s1.length < s2.length ? s2 : s1;
    let shorter = s1.length < s2.length ? s1 : s2;
    if (longer.length === 0) return 1.0;

    const editDistance = (a, b) => {
        const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
        for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                matrix[i][j] = a[i - 1] === b[j - 1] 
                    ? matrix[i - 1][j - 1] 
                    : Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]) + 1;
            }
        }
        return matrix[a.length][b.length];
    };
    return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length);
}

// --- Dictionary Scraper ---
async function fetchWordDefinition(searchWord) {
  try {
    const response = await fetch("https://klonoredoama.github.io/");
    const html = await response.text();

    // Extracts the dictionaryData object directly from the website's <script> tag
    const match = html.match(/const\s+dictionaryData\s*=\s*({[\s\S]*?});/);
    if (!match) return null;

    const dictionaryData = JSON.parse(match[1]);

    const normalize = (str) => 
      str.toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/[ķǩ]/g, 'k').replace(/ż/g, 'z')
         .replace(/ģ/g, 'g').replace(/ž/g, 'z')
         .replace(/â/g, 'a');

    const query = normalize(searchWord.trim());
    let bestMatchKey = null;
    let highestScore = 0;

    for (const key of Object.keys(dictionaryData)) {
      const score = getSimilarity(query, normalize(key));
      if (score > highestScore) {
        highestScore = score;
        bestMatchKey = key;
      }
    }

    if (bestMatchKey && highestScore > 0.6) {
      const entry = dictionaryData[bestMatchKey];
      return {
        displayWord: bestMatchKey,
        ipa: entry.ipa || "N/A",
        pos: entry.pos || "N/A",
        definition: entry.meaning
      };
    }
    return null;
  } catch (error) {
    console.error("Scraper error:", error);
    return null;
  }
}

// --- Command Registration ---
const commands = [
  new SlashCommandBuilder()
    .setName("dict")
    .setDescription("Search for a word in the Edôâma dictionary")
    .addStringOption(option =>
      option.setName("word")
        .setDescription("The word to look up")
        .setRequired(true)
    )
    .setContexts([0, 1, 2]) // Contexts: Guilds, DMs, Group DMs
    .setIntegrationTypes([0, 1]), // Install types: Guild (Server) and User
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    // This part registers the command with Discord's API
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
})();

client.once(Events.ClientReady, () => {
  console.log(`Bot Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "dict") {
    const word = interaction.options.getString("word");
    await interaction.deferReply();
    
    const entry = await fetchWordDefinition(word);
    
    if (entry) {
      const embed = new EmbedBuilder()
        .setColor(0x2563eb)
        .setTitle(entry.displayWord)
        // Combined definition formatting
        .setDescription(`*${entry.pos}*\n**IPA:** ${entry.ipa}\n\n${entry.definition}\n\n**[View Full Dictionary](https://klonoredoama.github.io/)**`);
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply(`Word "${word}" not found.`);
    }
  }
});

// Login using the token from Render Environment Variables
client.login(process.env.DISCORD_TOKEN);
