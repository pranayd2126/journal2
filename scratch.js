const reader = new FileReader();
reader.readAsDataURL(file);
reader.onloadend = () => {
    const base64data = reader.result;
    // send as JSON
}
