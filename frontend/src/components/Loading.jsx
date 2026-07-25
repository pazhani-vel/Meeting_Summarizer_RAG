"use client";

export default function Loading() {
  return (
    <>
      <div className="loading-container">
        <div className="spinner"></div>

        <h2>Processing Your Video...</h2>

        <p>
          Extracting audio, generating transcript, creating embeddings,
          and preparing the meeting summary.
        </p>
      </div>

      <style jsx>{`
        .loading-container {
          width: 100%;
          max-width: 700px;
          margin: 40px auto;
          padding: 40px;
          text-align: center;
          background: #1e293b;
          border-radius: 15px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
          color: #f8fafc;
        }

        .spinner {
          width: 70px;
          height: 70px;
          margin: 0 auto 25px;
          border: 6px solid #334155;
          border-top: 6px solid #06b6d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        h2 {
          margin-bottom: 15px;
          color: #06b6d4;
        }

        p {
          color: #cbd5e1;
          line-height: 1.7;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .loading-container {
            margin: 20px 10px;
            padding: 25px;
          }

          .spinner {
            width: 55px;
            height: 55px;
          }
        }
      `}</style>
    </>
  );
}