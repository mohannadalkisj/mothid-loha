

export const playNotificationSound = () => {
    const audio=new Audio('/not.wav')
    if (audio) {
      audio!.play().catch((error) => {
        console.error('Failed to play sound:', error);
      });
    }
  };