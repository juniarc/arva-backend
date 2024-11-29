from connector.db import db
from sqlalchemy import Column, Integer, String, Boolean ,ForeignKey, Text
from sqlalchemy.orm import relationship
from bcrypt import hashpw, gensalt, checkpw



class User(db.Model):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone_number = Column(String(15), nullable=False)
    address_street = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    zip_code = Column(String(255), nullable=True)
    role = Column(String(255), nullable=False, default='user')
    profile_image = Column(Text, nullable=True)
    # shop_id = Column(Integer, ForeignKey('shop.shop_id'), nullable=True)

    # shop = relationship("Shop", backref="users")


    def __repr__(self):
        return f'<User {self.user_id} {self.username} {self.email} {self.role} {self.created_at}>'
    
    def get_id(self):
        return (self.id)
    
    def set_password(self, password):
        self.password = hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')
        

    def check_password(self, password):
        return checkpw(password.encode('utf-8'), self.password.encode('utf-8'))
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'username': self.username,
            'email': self.email,
            'password': self.password,
            'phone_number': self.phone_number,
            'address_street': self.address_street,
            'city': self.city,
            'state': self.state,
            'zip_code': self.zip_code,
            'role': self.role,
            # 'shop_id': self.shop_id,
            'profile_image': self.profile_image
        }