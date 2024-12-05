from connector.db import db
from sqlalchemy import Column, Integer, String, Boolean ,ForeignKey, Text
from sqlalchemy.orm import relationship
from bcrypt import hashpw, gensalt, checkpw



class User(db.Model):
    __tablename__ = "users"
    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(15), nullable=False)
    address_street = db.Column(db.String(255), nullable=True)
    address_province = db.Column(db.String(255), nullable=True)
    address_city = db.Column(db.String(255), nullable=True)
    address_district = db.Column(db.String(255), nullable=True)
    address_subdistrict = db.Column(db.String(255), nullable=True)
    zip_code = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(255), nullable=False, default='user')
    profile_image = db.Column(db.Text, nullable=True)
    address_label = db.Column(db.String(80), nullable=True)
    status = db.Column(db.String(20), nullable=True, server_default='active')


    shop = relationship("Shop", back_populates="user", cascade="all, delete", lazy=True)


    def __repr__(self):
        return f'<User {self.user_id} {self.username} {self.email} {self.role}>'
    
    def get_id(self):
        return (self.user_id)
    
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
            'address_city': self.address_city,
            'address_province': self.address_province,
            'address_district': self.address_district,
            'address_subdistrict': self.address_subdistrict,
            'zip_code': self.zip_code,
            'role': self.role,
            'profile_image': self.profile_image
        }