import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection
} from "@discordjs/voice";
import { spawn, type ChildProcess as NodeChildProcess } from "node:child_process";
import { Readable } from "node:stream";
import type { VoiceBasedChannel } from "discord.js";
import ffmpegPath from "ffmpeg-static";

type RadioSession = {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
  stationName: string;
  ffmpeg?: NodeChildProcess;
};

const sessions = new Map<string, RadioSession>();

export function getSession(guildId: string): RadioSession | undefined {
  return sessions.get(guildId);
}

export function stopSession(guildId: string): boolean {
  const session = sessions.get(guildId);
  if (!session) {
    return false;
  }
  session.player.stop(true);
  session.ffmpeg?.kill();
  session.connection.destroy();
  sessions.delete(guildId);
  return true;
}

/**
 * Rejoint (ou reutilise) le salon vocal donne et y joue le flux radio.
 * Une seule session est maintenue par serveur.
 */
export async function playStation(channel: VoiceBasedChannel, streamUrl: string, stationName: string): Promise<void> {
  const guildId = channel.guild.id;
  const existing = sessions.get(guildId);

  let connection = existing?.connection;
  if (!connection || existing?.channelId !== channel.id) {
    existing?.connection.destroy();
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: channel.guild.voiceAdapterCreator
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  }

  const response = await fetch(streamUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Le flux radio est indisponible (${response.status})`);
  }

  const bundledFfmpegPath = typeof ffmpegPath === "string" ? ffmpegPath : undefined;
  const executable = process.env.FFMPEG_PATH ?? bundledFfmpegPath;
  if (!executable) {
    throw new Error("FFmpeg est introuvable");
  }

  const ffmpeg = spawn(executable, [
    "-hide_banner",
    "-loglevel", "error",
    "-i", "pipe:0",
    "-c:a", "libopus",
    "-b:a", "128k",
    "-application", "audio",
    "-f", "opus",
    "pipe:1"
  ]);
  Readable.fromWeb(response.body as any).pipe(ffmpeg.stdin!);

  const player = existing?.channelId === channel.id ? existing.player : createAudioPlayer();
  const resource = createAudioResource(ffmpeg.stdout!, { inputType: StreamType.OggOpus });
  player.removeAllListeners("error");
  player.on("error", (error) => {
    console.error(`Erreur du lecteur radio sur le serveur ${guildId}`, error);
  });
  player.on("stateChange", (oldState, newState) => {
    console.log(`Lecteur radio ${guildId}: ${oldState.status} -> ${newState.status}`);
  });
  ffmpeg.stderr!.on("data", (data: Buffer) => {
    console.error(`FFmpeg radio sur le serveur ${guildId}: ${data.toString().trim()}`);
  });
  ffmpeg.on("error", (error: Error) => {
    console.error(`Impossible de demarrer FFmpeg sur le serveur ${guildId}`, error);
  });

  player.play(resource);
  connection.subscribe(player);

  connection.once(VoiceConnectionStatus.Disconnected, () => {
    sessions.delete(guildId);
  });

  sessions.set(guildId, { connection, player, channelId: channel.id, stationName, ffmpeg });
  await entersState(player, AudioPlayerStatus.Playing, 10_000);
  console.log(`Lecture audio active pour ${stationName} sur ${guildId}`);
}