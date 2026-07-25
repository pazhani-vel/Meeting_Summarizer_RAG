import os
import subprocess
import imageio_ffmpeg


class AudioExtractor:
    def __init__(self):
        # Automatically gets the ffmpeg executable
        self.ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

    def extract_audio(self, video_path: str, output_folder: str) -> str:
        """
        Extract audio from a video using imageio-ffmpeg.

        Args:
            video_path (str): Path to the uploaded video.
            output_folder (str): Folder where the audio will be saved.

        Returns:
            str: Path to the extracted audio (.wav)
        """

        os.makedirs(output_folder, exist_ok=True)

        audio_path = os.path.join(output_folder, "audio.wav")

        command = [
            self.ffmpeg_path,
            "-i", video_path,
            "-vn",                  # Ignore video
            "-acodec", "pcm_s16le", # WAV codec
            "-ar", "16000",         # 16 kHz
            "-ac", "1",             # Mono
            "-y",                   # Overwrite
            audio_path
        ]

        try:
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            return audio_path

        except subprocess.CalledProcessError as e:
            raise Exception(f"FFmpeg Error:\n{e.stderr}")

        except Exception as e:
            raise Exception(f"Audio extraction failed: {str(e)}")