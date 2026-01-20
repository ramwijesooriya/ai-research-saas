# Python 3.9 Image එක භාවිතා කරන්න
FROM python:3.9

# වැඩ කරන තැන (Directory) සකසන්න
WORKDIR /code

# dependencies ටික install කරගන්න
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# සම්පූර්ණ Code එකම copy කරගන්න
COPY ./app /code/app

# Docker container එක ඇතුලේ .env file එක නැති නිසා,
# අපි මේක Hugging Face Secrets වලට දාන නිසා මෙතන විශේෂ දෙයක් කරන්න ඕන නෑ.

# App එක Run කරන්න (Port 7860 තමයි HF Spaces වල Default Port එක)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]