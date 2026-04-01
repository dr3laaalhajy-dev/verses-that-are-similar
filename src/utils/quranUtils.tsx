import React from 'react';

/**
 * Highlights the name of Allah in red within the given Quranic text.
 * Matches common variations found in the Quran.
 */
export const renderQuranText = (text: string) => {
  if (!text) return null;

  // Pattern to match variations of "Allah" with vocalization
  // Matches: الله, اللَّه, لِلَّه, بِاللَّه, وَاللَّه, فَاللَّه, ٱللَّه, إلخ
  const allahRegex = /((?:اللَّه|لِلَّهِ?|بِاللَّهِ?|تَالاللَّهِ|فَاللَّهُ?|وَاللَّهُ?|اللَّهُمَّ?|أَاللَّهُ?|ٱللَّهِ?|بِٱللَّهِ?|وَٱللَّهُ?|فَٱللَّهُ?|تَٱللَّهِ?)(?:ُ|ِ|َ)?)/g;

  // Split and map
  const parts = text.split(allahRegex);

  return (
    <>
      {parts.map((part, index) => {
        // If this part is one of the matches, wrap in red
        if (part.match(allahRegex)) {
          return (
            <span key={index} className="word-allah">
              {part}
            </span>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};
