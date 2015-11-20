# Install all the node packages
sudo npm install

# We need to install less and you need to run it to compile the less files into
# CSS.
sudo gem install sass
sudo gem install sass-globbing

# Watch the sass files for changes (from the root dir).
sass -r sass-globbing --watch www/:www/
